/**
 * Shared configuration loader.
 *
 * RawConfig is the JSON exported from the math workbook. loadConfig()
 * validates it and turns it into the typed, normalised GameConfig that both
 * the playable game and the simulator use. No other code reads RawConfig.
 *
 * Units: awards are whole credits. Progressive meters are kept in
 * centicredits (1/100 cr) so that per-bet increments stay integers.
 */
import { WeightedTable } from './rng.ts';

export type JackpotType = 'Static' | 'Progressive';

export interface RawConfig {
  source: { file: string; sha256: string };
  symbols: string[];
  pays: { symbol: string; pays: number[] }[];
  lines: number[][];
  baseReels: string[][];
  fgReels: string[][];
  hnsReel: { symbol: string; weight: number }[];
  /** Money-ball prize tables (Low, Mid, High…), each a list of credit values or jackpot names with weights. */
  mbTables: { name: string; rows: { entry: string | number; weight: number }[] }[];
  /** Which MB table a base game spin uses. */
  mbTableDraw: { name: string; weight: number }[];
  hnsTrigger: { count: number; yes: number; no: number }[];
  jackpots: { name: string; reset: number; incrementPct: number; type: JackpotType }[];
  settings: Record<string, number>;
}

export type MbPrize =
  | { kind: 'credits'; credits: number }
  | { kind: 'jackpot'; jackpot: number /* index into GameConfig.jackpots */ };

export interface MbTable {
  name: string;
  prizes: WeightedTable<MbPrize>;
}

export interface Jackpot {
  name: string;
  progressive: boolean;
  resetCenti: number;
  /** Centicredits added to the meter on each paid spin (0 for static). */
  incrementCenti: number;
}

export interface GameConfig {
  sourceFile: string;
  sourceSha256: string;
  reels: number;
  rows: number;
  /** Symbol names; the engine works with indices into this array. */
  symbols: string[];
  symbolId: Readonly<Record<string, number>>;
  wild: number;
  scatter: number;
  money: number;
  /** linePay[symbol][count] in credits, count 0..reels. */
  linePay: number[][];
  /** scatterPay[count] in credits, count 0..reels. */
  scatterPay: number[];
  /** lines[line][reel] = row index (0 = top). */
  lines: number[][];
  baseReels: number[][];
  fgReels: number[][];
  hnsReel: number[];
  hnsReelWeights: WeightedTable<number>; // items are stop indices
  mbTables: MbTable[];
  /** Drawn at the start of each base game spin; items are indices into mbTables. */
  mbTableDraw: WeightedTable<number>;
  /** hnsTriggerYes[n] / hnsTriggerTotal[n] = chance n MBs (1..auto-1) trigger Hold & Spin. */
  hnsTriggerYes: number[];
  hnsTriggerTotal: number[];
  jackpots: Jackpot[];
  grandJackpot: number;
  bet: number;
  /** Value of one credit in cents (1 = a 1¢ game). Presentation only; the engine works in credits. */
  denomCents: number;
  fgTriggerCount: number;
  fgAward: number;
  fgRetriggerAward: number;
  hnsAutoTrigger: number;
  hnsRespins: number;
  hnsWeightedPositions: number;
  grandMbCount: number;
}

export class ConfigError extends Error {
  constructor(readonly problems: string[]) {
    super(`Invalid game config:\n  - ${problems.join('\n  - ')}`);
    this.name = 'ConfigError';
  }
}

const ROWS = 3;
const WILD = 'WW';
const SCATTER = 'SC1';
const MONEY = 'MB';
const GRAND = 'Grand';
const MAX_WEIGHT_TOTAL = 2 ** 31;

const REQUIRED_SETTINGS = [
  'Bet', 'Lines', 'FG Trigger SC1', 'FG Award', 'FG Retrigger Award',
  'HnS Auto Trigger MB', 'HnS Respins', 'HnS Weighted Positions', 'Grand MB Count', 'Denomination Cents',
] as const;

export function loadConfig(raw: RawConfig): GameConfig {
  const problems: string[] = [];
  const fail = (msg: string) => problems.push(msg);
  const isNonNegInt = (v: unknown) => typeof v === 'number' && Number.isInteger(v) && v >= 0;
  const isPosInt = (v: unknown) => typeof v === 'number' && Number.isInteger(v) && v > 0;

  // Symbols
  const symbols = raw.symbols;
  const symbolId: Record<string, number> = {};
  symbols.forEach((s, i) => {
    if (s in symbolId) fail(`Symbols: duplicate symbol ${s}`);
    symbolId[s] = i;
  });
  for (const s of [WILD, SCATTER, MONEY]) if (!(s in symbolId)) fail(`Symbols: required symbol ${s} missing`);

  // Settings
  const settings = raw.settings;
  for (const k of REQUIRED_SETTINGS) if (!isPosInt(settings[k])) fail(`Setting "${k}" must be a positive integer (got ${settings[k]})`);
  const reels = raw.baseReels.length;
  if (reels !== 5) fail(`Base reels: expected 5 reels, found ${reels}`);

  // Pays
  const linePay = symbols.map(() => new Array<number>(reels + 1).fill(0));
  const scatterPay = new Array<number>(reels + 1).fill(0);
  const paid = new Set<string>();
  for (const { symbol, pays } of raw.pays) {
    if (!(symbol in symbolId)) { fail(`Pays: unknown symbol ${symbol}`); continue; }
    if (paid.has(symbol)) fail(`Pays: duplicate row for ${symbol}`);
    paid.add(symbol);
    if (pays.length !== 3 || !pays.every(isNonNegInt)) { fail(`Pays: ${symbol} needs three non-negative integer pays (3/4/5 OAK)`); continue; }
    const target = symbol === SCATTER ? scatterPay : linePay[symbolId[symbol]];
    pays.forEach((p, i) => (target[3 + i] = p));
  }
  for (const s of symbols) if (!paid.has(s)) fail(`Pays: no row for symbol ${s}`);
  for (const s of [WILD, MONEY]) if (s in symbolId && linePay[symbolId[s]].some((p) => p > 0))
    fail(`Pays: ${s} has line pays, but it is not a line-paying symbol`);

  // Lines
  const lines = raw.lines;
  if (lines.length !== settings['Lines']) fail(`Lines: table has ${lines.length} lines but Setting "Lines" is ${settings['Lines']}`);
  const seen = new Set<string>();
  lines.forEach((l, i) => {
    if (l.length !== reels || !l.every((r) => Number.isInteger(r) && r >= 0 && r < ROWS))
      fail(`Lines: line ${i + 1} must have ${reels} row indices in 0..${ROWS - 1} (got ${JSON.stringify(l)})`);
    const key = l.join(',');
    if (seen.has(key)) fail(`Lines: line ${i + 1} duplicates an earlier line (${key})`);
    seen.add(key);
  });

  // Reel strips
  const strip = (name: string, s: string[]) => {
    if (s.length < ROWS) fail(`${name}: only ${s.length} stops`);
    return s.map((sym, i) => {
      if (!(sym in symbolId)) fail(`${name} stop ${i + 1}: unknown symbol ${sym}`);
      return symbolId[sym] ?? -1;
    });
  };
  const baseReels = raw.baseReels.map((s, i) => strip(`Base Reel${i + 1}`, s));
  if (raw.fgReels.length !== reels) fail(`FG reels: expected ${reels} reels, found ${raw.fgReels.length}`);
  const fgReels = raw.fgReels.map((s, i) => strip(`FG Reel${i + 1}`, s));

  // Hold & Spin reel
  const hnsReel = raw.hnsReel.map(({ symbol }, i) => {
    if (!(symbol in symbolId)) fail(`HoldnSpin Reel stop ${i + 1}: unknown symbol ${symbol}`);
    return symbolId[symbol] ?? -1;
  });
  raw.hnsReel.forEach(({ weight }, i) => { if (!isPosInt(weight)) fail(`HoldnSpin Reel stop ${i + 1}: weight must be a positive integer (got ${weight})`); });
  if (!raw.hnsReel.some((s) => s.symbol === MONEY)) fail(`HoldnSpin Reel: contains no ${MONEY}`);

  // Jackpots
  const bet = settings['Bet'];
  const jackpotIndex: Record<string, number> = {};
  const jackpots: Jackpot[] = raw.jackpots.map((j, i) => {
    if (j.name in jackpotIndex) fail(`Jackpot: duplicate ${j.name}`);
    jackpotIndex[j.name] = i;
    if (!isPosInt(j.reset)) fail(`Jackpot ${j.name}: reset must be a positive integer`);
    if (j.type !== 'Static' && j.type !== 'Progressive') fail(`Jackpot ${j.name}: type must be Static or Progressive (got ${j.type})`);
    const progressive = j.type === 'Progressive';
    // Increment in centicredits per paid spin = bet × 100 × pct / 100 = bet × pct.
    const incExact = bet * j.incrementPct;
    const incrementCenti = Math.round(incExact);
    if (!(j.incrementPct >= 0)) fail(`Jackpot ${j.name}: increment % must be ≥ 0`);
    else if (Math.abs(incExact - incrementCenti) > 1e-9) fail(`Jackpot ${j.name}: ${j.incrementPct}% of ${bet} cr is not a whole centicredit`);
    if (!progressive && j.incrementPct !== 0) fail(`Jackpot ${j.name}: static jackpots cannot have an increment`);
    return { name: j.name, progressive, resetCenti: j.reset * 100, incrementCenti: progressive ? incrementCenti : 0 };
  });
  if (!(GRAND in jackpotIndex)) fail(`Jackpot: ${GRAND} missing`);

  // MB prize tables
  const mbTableIndex: Record<string, number> = {};
  if (raw.mbTables.length === 0) fail('MBPay: no money-ball tables');
  const mbParsed = raw.mbTables.map(({ name, rows }, t) => {
    const label = `MBPay ${name}`;
    if (name in mbTableIndex) fail(`${label}: duplicate table name`);
    mbTableIndex[name] = t;
    if (rows.length === 0) fail(`${label}: table is empty`);
    const items: MbPrize[] = [];
    const weights: number[] = [];
    rows.forEach(({ entry, weight }, i) => {
      if (!isPosInt(weight)) fail(`${label} row ${i + 1}: weight must be a positive integer (got ${weight})`);
      if (typeof entry === 'number') {
        if (!isPosInt(entry)) fail(`${label} row ${i + 1}: credit value must be a positive integer (got ${entry})`);
        items.push({ kind: 'credits', credits: entry });
      } else {
        if (!(entry in jackpotIndex)) fail(`${label} row ${i + 1}: unknown jackpot ${entry}`);
        if (entry === GRAND) fail(`${label} row ${i + 1}: ${GRAND} is awarded by a full screen, not drawn`);
        items.push({ kind: 'jackpot', jackpot: jackpotIndex[entry] ?? -1 });
      }
      weights.push(weight);
    });
    if (weights.reduce((a, b) => a + b, 0) >= MAX_WEIGHT_TOTAL) fail(`${label}: weight total must be below 2^31`);
    return { name, items, weights };
  });

  // MB table draw
  const drawn = new Set<string>();
  raw.mbTableDraw.forEach(({ name, weight }, i) => {
    if (!(name in mbTableIndex)) fail(`MB Table Draw row ${i + 1}: unknown table ${name}`);
    if (drawn.has(name)) fail(`MB Table Draw: duplicate row for ${name}`);
    drawn.add(name);
    if (!isPosInt(weight)) fail(`MB Table Draw row ${i + 1}: weight must be a positive integer (got ${weight})`);
  });
  for (const { name } of raw.mbTables) if (!drawn.has(name)) fail(`MB Table Draw: no row for table ${name}`);

  // Hold & Spin trigger draw for 1..auto-1 MBs
  const auto = settings['HnS Auto Trigger MB'];
  const hnsTriggerYes = new Array<number>(auto).fill(0);
  const hnsTriggerTotal = new Array<number>(auto).fill(0);
  for (const { count, yes, no } of raw.hnsTrigger) {
    if (!Number.isInteger(count) || count < 1 || count >= auto) { fail(`HoldnSpin MB Trigger: count ${count} outside 1..${auto - 1}`); continue; }
    if (!isNonNegInt(yes) || !isNonNegInt(no) || yes + no === 0) fail(`HoldnSpin MB Trigger: count ${count} needs non-negative integer weights with a positive total`);
    if (hnsTriggerTotal[count]) fail(`HoldnSpin MB Trigger: duplicate row for ${count}`);
    hnsTriggerYes[count] = yes;
    hnsTriggerTotal[count] = yes + no;
  }
  for (let n = 1; n < auto; n++) if (!hnsTriggerTotal[n]) fail(`HoldnSpin MB Trigger: no row for ${n} MB`);

  const cells = reels * ROWS;
  if (settings['Grand MB Count'] > cells) fail(`Setting "Grand MB Count" (${settings['Grand MB Count']}) exceeds the ${cells} positions`);
  if (settings['HnS Auto Trigger MB'] > cells) fail(`Setting "HnS Auto Trigger MB" exceeds the ${cells} positions`);
  if (settings['FG Trigger SC1'] > reels) fail(`Setting "FG Trigger SC1" exceeds the number of reels`);

  if (raw.hnsReel.reduce((a, s) => a + s.weight, 0) >= MAX_WEIGHT_TOTAL) fail('HoldnSpin Reel Weights: weight total must be below 2^31');

  if (problems.length) throw new ConfigError(problems);

  return {
    sourceFile: raw.source.file,
    sourceSha256: raw.source.sha256,
    reels,
    rows: ROWS,
    symbols,
    symbolId,
    wild: symbolId[WILD],
    scatter: symbolId[SCATTER],
    money: symbolId[MONEY],
    linePay,
    scatterPay,
    lines,
    baseReels,
    fgReels,
    hnsReel,
    hnsReelWeights: new WeightedTable(hnsReel.map((_, i) => i), raw.hnsReel.map((s) => s.weight)),
    mbTables: mbParsed.map(({ name, items, weights }) => ({ name, prizes: new WeightedTable(items, weights) })),
    mbTableDraw: new WeightedTable(raw.mbTableDraw.map((d) => mbTableIndex[d.name]), raw.mbTableDraw.map((d) => d.weight)),
    hnsTriggerYes,
    hnsTriggerTotal,
    jackpots,
    grandJackpot: jackpotIndex[GRAND],
    bet,
    denomCents: settings['Denomination Cents'],
    fgTriggerCount: settings['FG Trigger SC1'],
    fgAward: settings['FG Award'],
    fgRetriggerAward: settings['FG Retrigger Award'],
    hnsAutoTrigger: auto,
    hnsRespins: settings['HnS Respins'],
    hnsWeightedPositions: settings['HnS Weighted Positions'],
    grandMbCount: settings['Grand MB Count'],
  };
}
