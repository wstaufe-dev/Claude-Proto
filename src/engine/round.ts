/**
 * The round transaction: one paid spin and every feature it leads to.
 *
 * playRound() takes the wager, plays the base spin, Hold & Spin and free
 * games to completion, and returns the ordered events and the total win.
 * settleRound() later credits that win. Both the playable game and the
 * simulator go through these two calls only.
 */
import type { GameConfig } from './config.ts';
import { cellsWith, countSymbol, evaluateLines, windowFor } from './evaluate.ts';
import type { GameEvent, HnsTrigger, Lock, Mode, RoundResult, SpinEvent, WinBreakdown } from './events.ts';
import { randInt, type RandomSource } from './rng.ts';
import { jackpotValue, type EngineState } from './state.ts';

export class SettlementError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SettlementError';
  }
}

/** Optional preconditions for test and demo tools. They still go through the normal rules. */
export interface RoundOptions {
  /** Base-game reel stops to use instead of drawing them. */
  forceBaseStops?: number[];
  /** MB table (index into cfg.mbTables) to use instead of drawing it. */
  forceMbTable?: number;
}

interface Ctx {
  cfg: GameConfig;
  state: EngineState;
  src: RandomSource;
  events: GameEvent[];
  breakdown: WinBreakdown;
  jackpotWins: { jackpot: number; amount: number }[];
  /** MB table (index into cfg.mbTables) drawn for this round. */
  mbTable: number;
}

export function playRound(cfg: GameConfig, state: EngineState, src: RandomSource, opts: RoundOptions = {}): RoundResult {
  if (state.pendingRound !== null) throw new SettlementError(`Round ${state.pendingRound} has not been settled`);
  if (state.credits < cfg.bet) throw new SettlementError(`Insufficient credits: ${state.credits} < bet ${cfg.bet}`);

  const roundId = state.roundsStarted++;
  state.pendingRound = roundId;
  state.credits -= cfg.bet;
  cfg.jackpots.forEach((j, i) => { if (j.progressive) state.meters[i] += j.incrementCenti; });

  // The MB table is drawn at the start of the base game spin and applies to the whole round.
  let mbTable: number;
  if (opts.forceMbTable !== undefined) {
    if (!cfg.mbTables[opts.forceMbTable]) throw new RangeError(`Forced MB table ${opts.forceMbTable} does not exist`);
    mbTable = opts.forceMbTable;
  } else {
    mbTable = cfg.mbTableDraw.pick(src);
  }
  const metersAtStart = state.meters.slice();

  const ctx: Ctx = {
    cfg, state, src, events: [], jackpotWins: [], mbTable,
    breakdown: {
      baseLines: 0, baseScatter: 0, freeLines: 0, freeScatter: 0,
      hnsCreditsBase: 0, hnsCreditsFree: 0, jackpots: cfg.jackpots.map(() => 0),
    },
  };

  const base = spin(ctx, 'base', 0, opts.forceBaseStops);
  ctx.breakdown.baseLines += base.lineTotal;
  ctx.breakdown.baseScatter += base.scatterPay;
  if (base.hnsTrigger) holdAndSpin(ctx, 'base', base.hnsTrigger, base.grid);
  if (base.freeGamesAwarded > 0) freeGames(ctx, base.freeGamesAwarded);

  let totalWin = 0;
  for (const e of ctx.events) {
    if (e.type === 'spin') totalWin += e.lineTotal + e.scatterPay;
    else if (e.type === 'hnsEnd') totalWin += e.total;
  }
  ctx.events.push({ type: 'roundEnd', totalWin });

  return {
    roundId,
    bet: cfg.bet,
    mbTable,
    metersAtStart,
    events: ctx.events,
    breakdown: ctx.breakdown,
    totalWin,
    metersAfter: state.meters.slice(),
    jackpotWins: ctx.jackpotWins,
  };
}

/** Credits a played round's win. Rejects results that are stale or already settled. */
export function settleRound(state: EngineState, result: RoundResult): void {
  if (state.pendingRound !== result.roundId)
    throw new SettlementError(`Round ${result.roundId} is not awaiting settlement (pending: ${state.pendingRound})`);
  state.credits += result.totalWin;
  state.pendingRound = null;
}

function spin(ctx: Ctx, mode: Mode, freeGame: number, forcedStops?: number[]): SpinEvent {
  const { cfg, src } = ctx;
  const strips = mode === 'base' ? cfg.baseReels : cfg.fgReels;
  let stops: number[];
  if (forcedStops) {
    if (forcedStops.length !== cfg.reels || forcedStops.some((s, r) => !Number.isInteger(s) || s < 0 || s >= strips[r].length))
      throw new RangeError(`Forced stops ${JSON.stringify(forcedStops)} are out of range`);
    stops = forcedStops.slice();
  } else {
    stops = strips.map((s) => randInt(src, s.length));
  }
  const grid = windowFor(cfg, strips, stops);

  const lineWins = evaluateLines(cfg, grid);
  let lineTotal = 0;
  for (const w of lineWins) lineTotal += w.pay;

  const scatterCount = countSymbol(grid, cfg.scatter);
  const scatterPay = cfg.scatterPay[scatterCount];
  const freeGamesAwarded = scatterCount >= cfg.fgTriggerCount ? (mode === 'base' ? cfg.fgAward : cfg.fgRetriggerAward) : 0;

  const mbCount = countSymbol(grid, cfg.money);
  let hnsTrigger: HnsTrigger | null = null;
  if (mbCount >= cfg.hnsAutoTrigger) hnsTrigger = 'auto';
  else if (mbCount > 0 && randInt(src, cfg.hnsTriggerTotal[mbCount]) < cfg.hnsTriggerYes[mbCount]) hnsTrigger = 'draw';

  const event: SpinEvent = {
    type: 'spin', mode, freeGame, mbTable: ctx.mbTable, stops, grid, lineWins, lineTotal,
    scatterCount, scatterPay, freeGamesAwarded, mbCount, hnsTrigger,
  };
  ctx.events.push(event);
  return event;
}

function freeGames(ctx: Ctx, awarded: number): void {
  ctx.events.push({ type: 'freeGamesStart', games: awarded });
  let remaining = awarded;
  let played = 0;
  let total = 0;
  while (remaining > 0) {
    remaining--;
    played++;
    const fs = spin(ctx, 'free', played);
    ctx.breakdown.freeLines += fs.lineTotal;
    ctx.breakdown.freeScatter += fs.scatterPay;
    total += fs.lineTotal + fs.scatterPay;
    remaining += fs.freeGamesAwarded;
    if (fs.hnsTrigger) total += holdAndSpin(ctx, 'free', fs.hnsTrigger, fs.grid);
  }
  ctx.events.push({ type: 'freeGamesEnd', gamesPlayed: played, total });
}

/** Plays Hold & Spin to completion. Returns its total award. */
function holdAndSpin(ctx: Ctx, mode: Mode, trigger: HnsTrigger, grid: number[]): number {
  const { cfg, src } = ctx;
  const cells = cfg.reels * cfg.rows;
  const locked = new Array<boolean>(cells).fill(false);
  const locks: Lock[] = [];
  const prizes = cfg.mbTables[ctx.mbTable].prizes;
  let creditTotal = 0;
  let jackpotTotal = 0;

  const lock = (cell: number): Lock => {
    const prize = prizes.pick(src);
    const amount = prize.kind === 'credits' ? prize.credits : awardJackpot(ctx, prize.jackpot);
    if (prize.kind === 'credits') creditTotal += amount;
    else jackpotTotal += amount;
    locked[cell] = true;
    const l: Lock = { cell, prize, amount };
    locks.push(l);
    return l;
  };

  const initial = cellsWith(grid, cfg.money).map(lock);
  let respins = cfg.hnsRespins;
  ctx.events.push({ type: 'hnsStart', mode, trigger, mbTable: ctx.mbTable, locks: initial, respins, meters: ctx.state.meters.slice() });

  const strip = cfg.hnsReel;
  while (respins > 0 && locks.length < cells) {
    const unlocked: number[] = [];
    for (let c = 0; c < cells; c++) if (!locked[c]) unlocked.push(c);

    // Choose which unlocked cells use the weighted strip: partial Fisher–Yates over `unlocked`.
    const k = Math.min(cfg.hnsWeightedPositions, unlocked.length);
    const order = unlocked.slice();
    for (let i = 0; i < k; i++) {
      const j = i + randInt(src, order.length - i);
      [order[i], order[j]] = [order[j], order[i]];
    }
    const weighted = new Set(order.slice(0, k));

    const landed: { cell: number; stop: number; symbol: number }[] = [];
    const newLocks: Lock[] = [];
    for (const cell of unlocked) {
      const stop = weighted.has(cell) ? cfg.hnsReelWeights.pickIndex(src) : randInt(src, strip.length);
      const symbol = strip[stop];
      landed.push({ cell, stop, symbol });
      if (symbol === cfg.money) newLocks.push(lock(cell));
    }
    respins = newLocks.length > 0 ? cfg.hnsRespins : respins - 1;
    ctx.events.push({
      type: 'hnsRespin', weightedCells: [...weighted].sort((a, b) => a - b), landed, newLocks, respinsLeft: respins,
      meters: ctx.state.meters.slice(),
    });
  }

  const grand = locks.length >= cfg.grandMbCount ? awardJackpot(ctx, cfg.grandJackpot) : 0;
  const total = creditTotal + jackpotTotal + grand;
  if (mode === 'base') ctx.breakdown.hnsCreditsBase += creditTotal;
  else ctx.breakdown.hnsCreditsFree += creditTotal;
  ctx.events.push({ type: 'hnsEnd', mode, mbTable: ctx.mbTable, lockedCount: locks.length, creditTotal, jackpotTotal, grand, total, meters: ctx.state.meters.slice() });
  return total;
}

/** Pays a jackpot at its current value and resets its meter. */
function awardJackpot(ctx: Ctx, jackpot: number): number {
  const j = ctx.cfg.jackpots[jackpot];
  const amount = jackpotValue(ctx.state, jackpot);
  if (j.progressive) ctx.state.meters[jackpot] = j.resetCenti;
  ctx.breakdown.jackpots[jackpot] += amount;
  ctx.jackpotWins.push({ jackpot, amount });
  return amount;
}

