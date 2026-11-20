/**
 * Semantic events returned by the engine. The playable game animates them
 * in order; the simulator aggregates them. Neither recalculates their values.
 */
import type { MbPrize } from './config.ts';
import type { LineWin } from './evaluate.ts';

export type Mode = 'base' | 'free';
export type HnsTrigger = 'auto' | 'draw';

/** A money ball locked in Hold & Spin, with the credits it is worth. */
export interface Lock {
  cell: number;
  prize: MbPrize;
  /** Credits: the MB value, or the jackpot amount paid. */
  amount: number;
}

export interface SpinEvent {
  type: 'spin';
  mode: Mode;
  /** 1-based free game number (0 in the base game). */
  freeGame: number;
  /** MB table in effect (index into GameConfig.mbTables), drawn at the start of the base game spin. */
  mbTable: number;
  stops: number[];
  grid: number[];
  lineWins: LineWin[];
  lineTotal: number;
  scatterCount: number;
  scatterPay: number;
  freeGamesAwarded: number;
  mbCount: number;
  /** Set when this spin starts Hold & Spin. */
  hnsTrigger: HnsTrigger | null;
}

export interface FreeGamesStartEvent { type: 'freeGamesStart'; games: number }
export interface FreeGamesEndEvent { type: 'freeGamesEnd'; gamesPlayed: number; total: number }

export interface HnsStartEvent {
  type: 'hnsStart';
  mode: Mode;
  trigger: HnsTrigger;
  mbTable: number;
  locks: Lock[];
  respins: number;
  /** Meter values (centicredits) after this step's jackpot awards. */
  meters: number[];
}

export interface HnsRespinEvent {
  type: 'hnsRespin';
  /** Unlocked cells that used the weighted strip this respin. */
  weightedCells: number[];
  /** Every unlocked cell's result this respin. */
  landed: { cell: number; stop: number; symbol: number }[];
  newLocks: Lock[];
  respinsLeft: number;
  meters: number[];
}

export interface HnsEndEvent {
  type: 'hnsEnd';
  mode: Mode;
  mbTable: number;
  lockedCount: number;
  creditTotal: number;
  /** Mini/Minor/Major awards from locked MBs. */
  jackpotTotal: number;
  /** Grand amount (0 if the screen was not filled). */
  grand: number;
  total: number;
  meters: number[];
}

export interface RoundEndEvent { type: 'roundEnd'; totalWin: number }

export type GameEvent =
  | SpinEvent
  | FreeGamesStartEvent
  | FreeGamesEndEvent
  | HnsStartEvent
  | HnsRespinEvent
  | HnsEndEvent
  | RoundEndEvent;

/** Where each credit of a round's win came from. Sums to RoundResult.totalWin. */
export interface WinBreakdown {
  baseLines: number;
  baseScatter: number;
  freeLines: number;
  freeScatter: number;
  hnsCreditsBase: number;
  hnsCreditsFree: number;
  /** Jackpot awards by jackpot index (Mini, Minor, Major, Grand…). */
  jackpots: number[];
}

export interface RoundResult {
  roundId: number;
  bet: number;
  /** MB table drawn for this round. */
  mbTable: number;
  /** Meter values (centicredits) once this round's contributions are added, before any award. */
  metersAtStart: number[];
  events: GameEvent[];
  breakdown: WinBreakdown;
  totalWin: number;
  /** Meter values (centicredits) after this round's contributions and resets. */
  metersAfter: number[];
  /** Jackpot wins in this round, in award order. */
  jackpotWins: { jackpot: number; amount: number }[];
}

export function breakdownTotal(b: WinBreakdown): number {
  let t = b.baseLines + b.baseScatter + b.freeLines + b.freeScatter + b.hnsCreditsBase + b.hnsCreditsFree;
  for (const j of b.jackpots) t += j;
  return t;
}
