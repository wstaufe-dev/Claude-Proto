/** Turning engine MB prizes into coin labels, and cosmetic draws for spinning coins. */
import type { GameConfig, MbPrize, WeightedTable } from '../../../src/engine/index.ts';
import type { CoinLabel } from '../art/symbols.ts';

export function prizeLabel(cfg: GameConfig, p: MbPrize): CoinLabel {
  return p.kind === 'credits' ? { credits: p.credits } : { jackpot: cfg.jackpots[p.jackpot].name };
}

/**
 * A value for a coin that is only spinning past: drawn with replacement from the
 * MB table the round is using. Display only, never an outcome.
 */
export function cosmeticLabel(cfg: GameConfig, table: WeightedTable<MbPrize>): CoinLabel {
  return prizeLabel(cfg, table.items[table.indexFor(Math.floor(Math.random() * table.total))]);
}

/** Every credit value that appears in any MB table (to pre-render). */
export function allCreditValues(cfg: GameConfig): number[] {
  const s = new Set<number>();
  for (const t of cfg.mbTables) for (const p of t.prizes.items) if (p.kind === 'credits') s.add(p.credits);
  return [...s];
}
