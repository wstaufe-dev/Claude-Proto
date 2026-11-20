/**
 * Excel → raw JSON exporter.
 *
 * Reads the math workbook, pulls each table out by its header, and writes
 * a RawConfig JSON file. It does no interpretation beyond reading cells:
 * every rule check and normalisation lives in src/engine/config.ts
 * (loadConfig), so the game and the simulator validate the same way.
 *
 * Usage: npm run export-config [-- <xlsx> <out.json>]
 */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { basename } from 'node:path';
import ExcelJS from 'exceljs';
import { loadConfig, type RawConfig } from '../src/engine/config.ts';

const [xlsxPath = 'math/Proto_v2.xlsx', outPath = 'math/proto_v2.config.json'] = process.argv.slice(2);

type Cell = string | number | null;

const wb = new ExcelJS.Workbook();
await wb.xlsx.readFile(xlsxPath);
const ws = wb.worksheets[0];
if (!ws) throw new Error(`${xlsxPath}: workbook has no sheets`);

function cell(row: number, col: number): Cell {
  const v = ws.getCell(row, col).value;
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number' || typeof v === 'string') return typeof v === 'string' ? v.trim() : v;
  if (typeof v === 'object' && 'result' in v) return (v.result as Cell) ?? null; // formula
  throw new Error(`Unsupported cell value at R${row}C${col}: ${JSON.stringify(v)}`);
}

/** Column index of the header cell in row 1 whose text equals `header` (must be unique). */
function headerCol(header: string): number {
  const hits: number[] = [];
  for (let c = 1; c <= ws.columnCount; c++) if (cell(1, c) === header) hits.push(c);
  if (hits.length !== 1) throw new Error(`Header "${header}" found ${hits.length} times in row 1 (expected 1)`);
  return hits[0];
}

/** One column below a header, read until the first blank cell. */
function column(col: number): Cell[] {
  const out: Cell[] = [];
  for (let r = 2; r <= ws.rowCount; r++) {
    const v = cell(r, col);
    if (v === null) break;
    out.push(v);
  }
  return out;
}

/** A table starting at `header`, `width` columns wide, read until its first column is blank. */
function table(header: string, width: number): Cell[][] {
  const c0 = headerCol(header);
  const rows: Cell[][] = [];
  for (let r = 2; r <= ws.rowCount; r++) {
    if (cell(r, c0) === null) break;
    rows.push(Array.from({ length: width }, (_, i) => cell(r, c0 + i)));
  }
  return rows;
}

/** Names of the "MBPay <name>" tables in row 1, left to right. */
function mbTableNames(): string[] {
  const names: string[] = [];
  for (let c = 1; c <= ws.columnCount; c++) {
    const h = cell(1, c);
    if (typeof h === 'string' && h.startsWith('MBPay ')) names.push(h.slice('MBPay '.length));
  }
  return names;
}

const str = (v: Cell) => String(v);
const num = (v: Cell) => (typeof v === 'number' ? v : Number.NaN);

// The base reel and line tables both use "Reel1".."Reel5" headers, so base reels are located via ReelStop.
const reelStopCol = headerCol('ReelStop');

const raw: RawConfig = {
  source: { file: basename(xlsxPath), sha256: createHash('sha256').update(readFileSync(xlsxPath)).digest('hex') },
  symbols: column(headerCol('Symbols')).map(str),
  pays: table('Pays', 4).map(([s, p3, p4, p5]) => ({ symbol: str(s), pays: [num(p3), num(p4), num(p5)] })),
  lines: table('Lines', 6).map((r) => r.slice(1).map(num)),
  baseReels: [1, 2, 3, 4, 5].map((i) => column(reelStopCol + i).map(str)),
  fgReels: [1, 2, 3, 4, 5].map((i) => column(headerCol(`FG Reel${i}`)).map(str)),
  hnsReel: table('HoldnSpin Reel', 2).map(([s, w]) => ({ symbol: str(s), weight: num(w) })),
  mbTables: mbTableNames().map((name) => ({
    name,
    rows: table(`MBPay ${name}`, 2).map(([e, w]) => ({ entry: typeof e === 'number' ? e : str(e), weight: num(w) })),
  })),
  mbTableDraw: table('MB Table Draw', 2).map(([n, w]) => ({ name: str(n), weight: num(w) })),
  hnsTrigger: table('HoldnSpin MB Trigger', 3).map(([n, y, no]) => ({ count: num(n), yes: num(y), no: num(no) })),
  jackpots: table('Jackpot', 4).map(([n, r, inc, t]) => ({
    name: str(n), reset: num(r), incrementPct: num(inc), type: str(t) as RawConfig['jackpots'][number]['type'],
  })),
  settings: Object.fromEntries(table('Setting', 2).map(([k, v]) => [str(k), num(v)])),
};

// Validate before writing, so a bad workbook never produces a config file.
const cfg = loadConfig(raw);
writeFileSync(outPath, JSON.stringify(raw, null, 2) + '\n');
console.log(`Wrote ${outPath} from ${xlsxPath} (sha256 ${raw.source.sha256.slice(0, 12)}…)`);
console.log(`  ${cfg.symbols.length} symbols, ${cfg.lines.length} lines, base reels ${cfg.baseReels.map((r) => r.length).join('/')}, ` +
  `HnS reel ${cfg.hnsReel.length} stops, MB tables ${cfg.mbTables.map((m) => `${m.name} (${m.prizes.items.length})`).join(', ')}, ${cfg.jackpots.length} jackpots`);
