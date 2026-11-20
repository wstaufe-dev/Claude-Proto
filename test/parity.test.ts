/**
 * Simulator vs exact analysis: the engine's base-game behaviour must match
 * the figures computed independently from the strips.
 */
import { describe, expect, it } from 'vitest';
import { createState, playRound, SeededRandom, settleRound } from '../src/engine/index.ts';
import { exactBase } from '../src/sim/exact.ts';
import { realConfig } from './helpers.ts';

describe('simulated base game matches exact analysis', () => {
  const cfg = realConfig();
  const exact = exactBase(cfg);
  const N = 400_000;
  const state = createState(cfg, 1e12);
  const src = new SeededRandom(77);

  let lineSum = 0, lineSq = 0, scatSum = 0, scatSq = 0, fg = 0, hnsAuto = 0, hnsDraw = 0;
  for (let i = 0; i < N; i++) {
    const r = playRound(cfg, state, src);
    settleRound(state, r);
    const base = r.events[0];
    if (base.type !== 'spin') throw new Error('first event must be the base spin');
    lineSum += base.lineTotal; lineSq += base.lineTotal ** 2;
    scatSum += base.scatterPay; scatSq += base.scatterPay ** 2;
    if (base.freeGamesAwarded) fg++;
    if (base.hnsTrigger === 'auto') hnsAuto++;
    if (base.hnsTrigger === 'draw') hnsDraw++;
  }

  /** |observed mean − expected| in standard errors. */
  const zMean = (sum: number, sq: number, expected: number) => {
    const mean = sum / N;
    const sd = Math.sqrt(sq / N - mean * mean);
    return Math.abs(mean - expected) / (sd / Math.sqrt(N));
  };
  const zRate = (hits: number, p: number) => Math.abs(hits - N * p) / Math.sqrt(N * p * (1 - p));

  it('line return', () => expect(zMean(lineSum, lineSq, exact.lineReturn * cfg.bet)).toBeLessThan(4));
  it('scatter return', () => expect(zMean(scatSum, scatSq, exact.scatterReturn * cfg.bet)).toBeLessThan(4));
  it('free games trigger rate', () => expect(zRate(fg, exact.pFreeGames)).toBeLessThan(4));
  it('Hold & Spin auto trigger rate', () => expect(zRate(hnsAuto, exact.pHnsAuto)).toBeLessThan(4));
  it('Hold & Spin draw trigger rate', () => expect(zRate(hnsDraw, exact.pHnsDraw)).toBeLessThan(4));
});
