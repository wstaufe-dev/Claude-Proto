/**
 * Engine state: credit balance, progressive meters and the round awaiting
 * settlement. The engine is the only code that changes these values.
 */
import type { GameConfig } from './config.ts';

export interface EngineState {
  /** Player balance in credits. */
  credits: number;
  /** Meter value per jackpot, in centicredits (static jackpots stay at their reset value). */
  meters: number[];
  /** Number of rounds started; also the id of the next round. */
  roundsStarted: number;
  /** Id of the round played but not yet settled, or null. */
  pendingRound: number | null;
}

export function createState(cfg: GameConfig, credits = 0): EngineState {
  return {
    credits,
    meters: cfg.jackpots.map((j) => j.resetCenti),
    roundsStarted: 0,
    pendingRound: null,
  };
}

/** Whole credits a jackpot pays right now (meters are floored to whole credits). */
export function jackpotValue(state: EngineState, jackpot: number): number {
  return Math.floor(state.meters[jackpot] / 100);
}

/** Adds credits to the machine. Not allowed while a round awaits settlement. */
export function cashIn(state: EngineState, amount: number): void {
  if (!Number.isInteger(amount) || amount <= 0) throw new RangeError(`Cash in must be a positive whole number of credits (got ${amount})`);
  if (state.pendingRound !== null) throw new Error('Cannot cash in during a round');
  state.credits += amount;
}

/** Removes the whole balance and returns it. Not allowed while a round awaits settlement. */
export function cashOut(state: EngineState): number {
  if (state.pendingRound !== null) throw new Error('Cannot cash out during a round');
  const amount = state.credits;
  state.credits = 0;
  return amount;
}
