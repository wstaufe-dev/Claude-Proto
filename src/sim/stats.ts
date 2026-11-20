/**
 * Simulation statistics. Stats observe RoundResults and never decide outcomes.
 * Accumulators are plain JSON so worker results can be merged.
 */
import { breakdownTotal, type GameConfig, type RoundResult } from '../engine/index.ts';

/** Upper bounds (× bet, exclusive) of the win-size buckets; the final bucket is open-ended. */
export const WIN_BUCKETS = [0, 1, 2, 5, 10, 20, 50, 100, 500, Infinity] as const;

export interface Stats {
  rounds: number;
  wagered: number;
  won: number;
  sumSq: number;
  hits: number;
  maxWin: number;
  baseLines: number;
  baseScatter: number;
  freeLines: number;
  freeScatter: number;
  hnsCreditsBase: number;
  hnsCreditsFree: number;
  jackpotPaid: number[];
  jackpotHits: number[];
  fgTriggers: number;
  fgRetriggers: number;
  freeSpins: number;
  hnsBaseAuto: number;
  hnsBaseDraw: number;
  hnsFreeAuto: number;
  hnsFreeDraw: number;
  hnsAward: number;
  /** Hold & Spin endings by number of locked positions (index 0..15). */
  hnsLocked: number[];
  /** Base-game spins by scatter count (index 0..5). */
  baseScatterCount: number[];
  /** Base-game spins by MB count (index 0..15). */
  baseMbCount: number[];
  /** Rounds by win size: [=0, (0,1), [1,2), …] × bet. */
  winBuckets: number[];
}

export function emptyStats(cfg: GameConfig): Stats {
  const cells = cfg.reels * cfg.rows;
  return {
    rounds: 0, wagered: 0, won: 0, sumSq: 0, hits: 0, maxWin: 0,
    baseLines: 0, baseScatter: 0, freeLines: 0, freeScatter: 0, hnsCreditsBase: 0, hnsCreditsFree: 0,
    jackpotPaid: cfg.jackpots.map(() => 0), jackpotHits: cfg.jackpots.map(() => 0),
    fgTriggers: 0, fgRetriggers: 0, freeSpins: 0,
    hnsBaseAuto: 0, hnsBaseDraw: 0, hnsFreeAuto: 0, hnsFreeDraw: 0, hnsAward: 0,
    hnsLocked: new Array(cells + 1).fill(0),
    baseScatterCount: new Array(cfg.reels + 1).fill(0),
    baseMbCount: new Array(cells + 1).fill(0),
    winBuckets: new Array(WIN_BUCKETS.length).fill(0),
  };
}

export class ReconciliationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ReconciliationError';
  }
}

export function record(s: Stats, r: RoundResult): void {
  // Reconcile: categorised sources must add up to the engine's total.
  const b = r.breakdown;
  const sum = breakdownTotal(b);
  if (sum !== r.totalWin) throw new ReconciliationError(`Round ${r.roundId}: breakdown ${sum} ≠ total ${r.totalWin}`);
  let jp = 0;
  for (const w of r.jackpotWins) jp += w.amount;
  if (jp !== b.jackpots.reduce((a, x) => a + x, 0)) throw new ReconciliationError(`Round ${r.roundId}: jackpot wins ≠ jackpot breakdown`);

  s.rounds++;
  s.wagered += r.bet;
  s.won += r.totalWin;
  s.sumSq += r.totalWin * r.totalWin;
  if (r.totalWin > 0) s.hits++;
  if (r.totalWin > s.maxWin) s.maxWin = r.totalWin;
  s.baseLines += b.baseLines;
  s.baseScatter += b.baseScatter;
  s.freeLines += b.freeLines;
  s.freeScatter += b.freeScatter;
  s.hnsCreditsBase += b.hnsCreditsBase;
  s.hnsCreditsFree += b.hnsCreditsFree;
  for (let i = 0; i < b.jackpots.length; i++) s.jackpotPaid[i] += b.jackpots[i];
  for (const w of r.jackpotWins) s.jackpotHits[w.jackpot]++;

  for (const e of r.events) {
    switch (e.type) {
      case 'spin':
        if (e.mode === 'base') {
          s.baseScatterCount[e.scatterCount]++;
          s.baseMbCount[e.mbCount]++;
          if (e.freeGamesAwarded) s.fgTriggers++;
          if (e.hnsTrigger === 'auto') s.hnsBaseAuto++;
          if (e.hnsTrigger === 'draw') s.hnsBaseDraw++;
        } else {
          s.freeSpins++;
          if (e.freeGamesAwarded) s.fgRetriggers++;
          if (e.hnsTrigger === 'auto') s.hnsFreeAuto++;
          if (e.hnsTrigger === 'draw') s.hnsFreeDraw++;
        }
        break;
      case 'hnsEnd':
        s.hnsAward += e.total;
        s.hnsLocked[e.lockedCount]++;
        break;
    }
  }

  const x = r.totalWin / r.bet;
  let k = 0;
  if (r.totalWin > 0) { k = 1; while (x >= WIN_BUCKETS[k]) k++; }
  s.winBuckets[k]++;
}

export function merge(a: Stats, b: Stats): Stats {
  const out = structuredClone(a) as unknown as Record<string, number | number[]>;
  for (const [k, v] of Object.entries(b)) {
    if (k === 'maxWin') out[k] = Math.max(out[k] as number, v as number);
    else if (Array.isArray(v)) out[k] = (out[k] as number[]).map((x, i) => x + v[i]);
    else out[k] = (out[k] as number) + (v as number);
  }
  return out as unknown as Stats;
}
