/** Runs rounds through the shared engine and accumulates statistics. */
import { createState, playRound, SeededRandom, settleRound, type GameConfig } from '../engine/index.ts';
import { emptyStats, record, type Stats } from './stats.ts';

export function runRounds(cfg: GameConfig, seed: number, stream: number, rounds: number, onProgress?: (done: number) => void): Stats {
  const src = new SeededRandom(seed, stream);
  const state = createState(cfg, Number.MAX_SAFE_INTEGER / 4);
  const stats = emptyStats(cfg);
  const every = 250_000;
  for (let i = 1; i <= rounds; i++) {
    const result = playRound(cfg, state, src);
    record(stats, result);
    settleRound(state, result);
    if (state.credits < cfg.bet * 1e6) state.credits = Number.MAX_SAFE_INTEGER / 4;
    if (onProgress && i % every === 0) onProgress(every);
  }
  if (onProgress) onProgress(rounds % every);
  return stats;
}
