/**
 * Monte Carlo simulator.
 *
 *   npm run sim -- [--rounds 10000000] [--seed 1] [--workers N] [--config math/proto_v2.config.json]
 *
 * Each worker runs its own SeededRandom stream (seed, workerIndex), so a
 * given (seed, workers, rounds) always gives the same result.
 * Writes a JSON report and a tab-delimited text report to reports/, and
 * copies the text report to reports/sim-latest.txt for the Excel import.
 */
import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { availableParallelism } from 'node:os';
import { Worker } from 'node:worker_threads';
import { exactBase } from './exact.ts';
import { DEFAULT_CONFIG, loadConfigFile } from './load.ts';
import { merge, WIN_BUCKETS, type Stats } from './stats.ts';

const args = new Map<string, string>();
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i += 2) args.set(argv[i].replace(/^--/, ''), argv[i + 1]);
const rounds = Number(args.get('rounds') ?? 10_000_000);
const seed = Number(args.get('seed') ?? 1) >>> 0;
const workers = Math.max(1, Math.min(Number(args.get('workers') ?? availableParallelism()), rounds));
const configPath = args.get('config') ?? DEFAULT_CONFIG;
if (!Number.isInteger(rounds) || rounds <= 0) throw new Error('--rounds must be a positive integer');

const cfg = loadConfigFile(configPath);
const exact = exactBase(cfg);
const t0 = performance.now();
let done = 0;
const tick = setInterval(() => {
  const s = (performance.now() - t0) / 1000;
  process.stderr.write(`\r  ${(done / 1e6).toFixed(1)}M / ${(rounds / 1e6).toFixed(1)}M rounds  ${(done / s / 1e6).toFixed(2)}M/s   `);
}, 1000);

const parts = await Promise.all(
  Array.from({ length: workers }, (_, w) => {
    const n = Math.floor(rounds / workers) + (w < rounds % workers ? 1 : 0);
    return new Promise<Stats>((resolve, reject) => {
      const worker = new Worker(new URL('./worker.ts', import.meta.url), {
        workerData: { configPath, seed, stream: w, rounds: n },
        execArgv: ['--import', 'tsx'],
      });
      worker.on('message', (m: { type: string; n?: number; stats?: Stats }) => {
        if (m.type === 'progress') done += m.n!;
        else if (m.type === 'done') resolve(m.stats!);
      });
      worker.on('error', reject);
      worker.on('exit', (code) => { if (code !== 0) reject(new Error(`worker ${w} exited with code ${code}`)); });
    });
  }),
);
clearInterval(tick);
process.stderr.write('\r' + ' '.repeat(60) + '\r');
const secs = (performance.now() - t0) / 1000;
const s = parts.reduce(merge);

// ---------- report ----------
const N = s.rounds;
const bet = cfg.bet;
const rtp = s.won / s.wagered;
const meanX = s.won / N / bet;
const sdX = Math.sqrt(Math.max(0, s.sumSq / N / (bet * bet) - meanX * meanX));
const ci = (1.96 * sdX) / Math.sqrt(N);
const pct = (x: number, d = 3) => `${(x * 100).toFixed(d)}%`;
const oneIn = (hits: number, of = N) => (hits ? `1 in ${fmt(of / hits)}` : `none in ${fmt(of)}`);
const fmt = (x: number) => (x >= 100 ? Math.round(x).toLocaleString('en-US') : x.toFixed(2));
const int = (x: number) => x.toLocaleString('en-US');
const pad = (t: string, n: number) => t.padEnd(n);

// Every report line goes to the console and, as Section / Item / columns, to the text report.
const tsv: string[][] = [];
let section = 'RUN';
const heading = (title: string) => { console.log(`\n${title}`); section = title; };
const row = (label: string, ...cols: string[]) => {
  console.log('  ' + pad(label, 26) + cols.map((c) => c.padStart(16)).join(''));
  tsv.push([section, label.trim(), ...cols]);
};
const note = (text: string, ...cols: string[]) => { console.log(text); tsv.push([section, text.trim().replace(/:$/, ''), ...cols]); };

console.log(`\n${cfg.sourceFile}  (sha256 ${cfg.sourceSha256.slice(0, 12)}…)  seed ${seed}, ${workers} workers`);
console.log(`${fmt(N)} rounds in ${secs.toFixed(1)} s (${(N / secs / 1e6).toFixed(2)}M rounds/s), bet ${bet} cr`);
tsv.push(['Section', 'Item', 'Value', 'Value 2']);
tsv.push([section, 'Date', new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC']);
tsv.push([section, 'Config file', cfg.sourceFile], [section, 'Config sha256', cfg.sourceSha256]);
tsv.push([section, 'Rounds', String(N)], [section, 'Seed', String(seed)], [section, 'Workers', String(workers)]);
tsv.push([section, 'Seconds', secs.toFixed(1)], [section, 'Bet (cr)', String(bet)]);

heading('RETURN TO PLAYER');
row('Total', pct(rtp), `± ${pct(ci)} (95%)`);
const src: [string, number, number | null][] = [
  ['Base lines', s.baseLines, exact.lineReturn],
  ['Base scatter', s.baseScatter, exact.scatterReturn],
  ['Free games lines', s.freeLines, null],
  ['Free games scatter', s.freeScatter, null],
  ['Hold & Spin credits (base)', s.hnsCreditsBase, null],
  ['Hold & Spin credits (FG)', s.hnsCreditsFree, null],
  ...cfg.jackpots.map((j, i) => [`${j.name} jackpot`, s.jackpotPaid[i], null] as [string, number, null]),
];
row('', 'simulated', 'exact');
for (const [label, amount, ex] of src) row(label, pct(amount / s.wagered), ex === null ? '' : pct(ex));

heading('FREQUENCIES');
row('', 'simulated', 'exact');
row('Any win', oneIn(s.hits), '');
row('Free games trigger', oneIn(s.fgTriggers), `1 in ${fmt(1 / exact.pFreeGames)}`);
row('Hold & Spin (base)', oneIn(s.hnsBaseAuto + s.hnsBaseDraw), `1 in ${fmt(1 / exact.pHns)}`);
row('  from 6+ MB', oneIn(s.hnsBaseAuto), `1 in ${fmt(1 / exact.pHnsAuto)}`);
row('  from 1–5 MB draw', oneIn(s.hnsBaseDraw), `1 in ${fmt(1 / exact.pHnsDraw)}`);
row('Hold & Spin (in FG)', oneIn(s.hnsFreeAuto + s.hnsFreeDraw), '');
row('FG retriggers', s.fgTriggers ? `${(s.fgRetriggers / s.fgTriggers).toFixed(4)} / trig` : '-', '');
for (let i = 0; i < cfg.jackpots.length; i++) row(`${cfg.jackpots[i].name} hits`, oneIn(s.jackpotHits[i]), int(s.jackpotHits[i]));

heading('FEATURES');
const hnsCount = s.hnsBaseAuto + s.hnsBaseDraw + s.hnsFreeAuto + s.hnsFreeDraw;
const fgWin = s.freeLines + s.freeScatter + s.hnsCreditsFree; // + jackpots won inside FG are in jackpotPaid
row('Avg free games played', s.fgTriggers ? (s.freeSpins / s.fgTriggers).toFixed(2) : '-');
row('Avg FG lines+scatter+HnS', s.fgTriggers ? `${(fgWin / s.fgTriggers / bet).toFixed(2)} × bet` : '-', 'excl. jackpots');
row('Avg Hold & Spin award', hnsCount ? `${(s.hnsAward / hnsCount / bet).toFixed(2)} × bet` : '-', 'incl. jackpots');
row('HnS MB chance / position', `${pct(exact.pMbUnweighted, 2)} unwtd`, `${pct(exact.pMbWeighted, 4)} wtd`);
note('  By MB table:                round share     HnS plays   avg HnS award', 'round share', 'HnS plays', 'avg HnS award');
cfg.mbTables.forEach((t, i) => {
  const cols = [pct(s.mbTableRounds[i] / N, 2), s.hnsByTable[i].toLocaleString('en-US'),
    s.hnsByTable[i] ? `${(s.hnsAwardByTable[i] / s.hnsByTable[i] / bet).toFixed(2)} × bet` : '-'];
  console.log('    ' + t.name.padEnd(24) + cols[0].padStart(14) + cols[1].padStart(14) + cols[2].padStart(16));
  tsv.push([section, `MB table ${t.name}`, ...cols]);
});
note('  Hold & Spin ending positions locked:');
const locked = s.hnsLocked.map((n, k) => [k, n] as const).filter(([, n]) => n > 0);
for (const [k, n] of locked) row(`    ${k}`, `${pct(n / hnsCount, 2)}`, int(n));

heading('VOLATILITY');
row('Std dev per round', `${sdX.toFixed(2)} × bet`);
row('Max round win', `${fmt(s.maxWin / bet)} × bet`, `${fmt(s.maxWin)} cr`);
note('  Round win distribution (× bet):');
s.winBuckets.forEach((n, k) => {
  const label = k === 0 ? '0' : k === 1 ? '(0, 1)' : WIN_BUCKETS[k] === Infinity ? `≥ ${WIN_BUCKETS[k - 1]}` : `[${WIN_BUCKETS[k - 1]}, ${WIN_BUCKETS[k]})`;
  row(`    ${label}`, pct(n / N, 4), int(n));
});

mkdirSync('reports', { recursive: true });
const out = `reports/sim-${cfg.sourceSha256.slice(0, 8)}-seed${seed}-${N}.json`;
writeFileSync(out, JSON.stringify({
  config: { file: cfg.sourceFile, sha256: cfg.sourceSha256 }, seed, workers, seconds: secs,
  rtp, rtpCi95: ci, sdPerRoundX: sdX, exactBase: exact, stats: s,
}, null, 2));
const outTxt = out.replace(/\.json$/, '.txt');
// UTF-8 with a byte-order mark and Windows line endings, so Excel and Notepad read ×, ≥ and ± correctly.
writeFileSync(outTxt, '\uFEFF' + tsv.map((r) => r.map((c) => c.replace(/[\t\r\n]+/g, ' ')).join('\t')).join('\r\n') + '\r\n');
copyFileSync(outTxt, 'reports/sim-latest.txt');
console.log(`\nReport written to ${out}`);
console.log(`Text report written to ${outTxt} (copied to reports/sim-latest.txt for the Excel import)`);
