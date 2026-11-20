/**
 * Exact base-game figures, computed analytically from the strips.
 * These are an independent check on the simulator.
 *
 * - Line return: a uniform stop makes every row's symbol on a reel follow
 *   that strip's symbol frequencies, so each line has the same expected pay.
 *   Enumerating every symbol combination with the engine's own
 *   evaluateSequence gives the exact value per line, times the number of lines.
 * - Scatter and MB counts: each reel's count distribution comes from
 *   enumerating its stops, and the reels are independent, so the
 *   distributions are convolved.
 */
import { evaluateSequence, type GameConfig } from '../engine/index.ts';

export interface ExactBase {
  lineReturn: number;
  scatterReturn: number;
  scatterDist: number[];
  pFreeGames: number;
  mbDist: number[];
  pHnsAuto: number;
  pHnsDraw: number;
  pHns: number;
  /** Chance one Hold & Spin position lands an MB on a respin. */
  pMbUnweighted: number;
  pMbWeighted: number;
}

function symbolFrequencies(strip: number[], nSymbols: number): number[] {
  const f = new Array<number>(nSymbols).fill(0);
  for (const s of strip) f[s] += 1 / strip.length;
  return f;
}

/** Expected pay of one line (credits). */
export function exactLinePay(cfg: GameConfig, strips: number[][]): number {
  const freqs = strips.map((s) => symbolFrequencies(s, cfg.symbols.length));
  const present = freqs.map((f) => f.map((p, s) => [s, p] as const).filter(([, p]) => p > 0));
  const seq = new Array<number>(cfg.reels);
  let ev = 0;
  const walk = (reel: number, prob: number) => {
    if (reel === cfg.reels) {
      ev += prob * evaluateSequence(cfg, seq)[2];
      return;
    }
    for (const [s, p] of present[reel]) {
      seq[reel] = s;
      walk(reel + 1, prob * p);
    }
  };
  walk(0, 1);
  return ev;
}

/** Distribution of how many `symbol`s are visible on one reel. */
export function windowCountDist(strip: number[], symbol: number, rows: number): number[] {
  const d = new Array<number>(rows + 1).fill(0);
  for (let stop = 0; stop < strip.length; stop++) {
    let n = 0;
    for (let r = 0; r < rows; r++) if (strip[(stop + r) % strip.length] === symbol) n++;
    d[n] += 1 / strip.length;
  }
  return d;
}

export function convolve(a: number[], b: number[]): number[] {
  const out = new Array<number>(a.length + b.length - 1).fill(0);
  a.forEach((x, i) => b.forEach((y, j) => (out[i + j] += x * y)));
  return out;
}

export function screenCountDist(cfg: GameConfig, strips: number[][], symbol: number): number[] {
  return strips.map((s) => windowCountDist(s, symbol, cfg.rows)).reduce(convolve, [1]);
}

export function exactBase(cfg: GameConfig): ExactBase {
  const strips = cfg.baseReels;
  const lineReturn = (exactLinePay(cfg, strips) * cfg.lines.length) / cfg.bet;

  const scatterDist = screenCountDist(cfg, strips, cfg.scatter);
  const scatterReturn = scatterDist.reduce((a, p, n) => a + p * (cfg.scatterPay[n] ?? 0), 0) / cfg.bet;
  const pFreeGames = scatterDist.reduce((a, p, n) => a + (n >= cfg.fgTriggerCount ? p : 0), 0);

  const mbDist = screenCountDist(cfg, strips, cfg.money);
  let pHnsAuto = 0;
  let pHnsDraw = 0;
  mbDist.forEach((p, n) => {
    if (n >= cfg.hnsAutoTrigger) pHnsAuto += p;
    else if (n > 0) pHnsDraw += (p * cfg.hnsTriggerYes[n]) / cfg.hnsTriggerTotal[n];
  });

  const mbStops = cfg.hnsReel.map((s, i) => [s, i] as const).filter(([s]) => s === cfg.money);
  const pMbUnweighted = mbStops.length / cfg.hnsReel.length;
  const pMbWeighted = mbStops.reduce((a, [, i]) => a + cfg.hnsReelWeights.probability(i), 0);

  return {
    lineReturn, scatterReturn, scatterDist, pFreeGames, mbDist,
    pHnsAuto, pHnsDraw, pHns: pHnsAuto + pHnsDraw, pMbUnweighted, pMbWeighted,
  };
}
