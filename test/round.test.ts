import { describe, expect, it } from 'vitest';
import {
  breakdownTotal, cashIn, cashOut, createState, playRound, SeededRandom, SettlementError, settleRound,
  type GameConfig, type GameEvent, type HnsRespinEvent,
} from '../src/engine/index.ts';
import { customConfig, realConfig } from './helpers.ts';

const BIG = 1e12;

/** Base reels where every stop shows the given symbol on each reel (3-stop strips). */
const solidReels = (...perReel: string[]) => perReel.map((s) => [s, s, s]);
const play = (cfg: GameConfig, seed = 1, state = createState(cfg, BIG)) => {
  const result = playRound(cfg, state, new SeededRandom(seed));
  settleRound(state, result);
  return { result, state };
};
const ofType = <T extends GameEvent['type']>(events: GameEvent[], t: T) =>
  events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === t);

describe('wager, meters and settlement', () => {
  const cfg = realConfig();

  it('debits the bet and credits the win only on settlement', () => {
    const state = createState(cfg, 1000);
    const result = playRound(cfg, state, new SeededRandom(3));
    expect(state.credits).toBe(1000 - cfg.bet);
    settleRound(state, result);
    expect(state.credits).toBe(1000 - cfg.bet + result.totalWin);
  });

  it('adds 0.56 cr to Major and 0.16 cr to Grand per paid spin', () => {
    const state = createState(cfg, BIG);
    const major = cfg.jackpots.findIndex((j) => j.name === 'Major');
    for (let i = 0; i < 10; i++) {
      const r = playRound(cfg, state, new SeededRandom(100 + i));
      settleRound(state, r);
      if (r.jackpotWins.length) return; // a jackpot win resets a meter; the scenario below covers that
    }
    expect(state.meters[major]).toBe(5_000_000 + 10 * 56);
    expect(state.meters[cfg.grandJackpot]).toBe(100_000_000 + 10 * 16);
  });

  it('rejects stale, duplicate and out-of-order settlement', () => {
    const state = createState(cfg, BIG);
    const r1 = playRound(cfg, state, new SeededRandom(1));
    expect(() => playRound(cfg, state, new SeededRandom(2))).toThrow(SettlementError);
    settleRound(state, r1);
    expect(() => settleRound(state, r1)).toThrow(SettlementError);
    const r2 = playRound(cfg, state, new SeededRandom(2));
    expect(() => settleRound(state, { ...r2, roundId: r1.roundId })).toThrow(SettlementError);
  });

  it('refuses to play without enough credits', () => {
    expect(() => playRound(cfg, createState(cfg, 79), new SeededRandom(1))).toThrow(/Insufficient/);
  });

  it('is deterministic for a seed', () => {
    const a = play(cfg, 99).result;
    const b = play(cfg, 99).result;
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});

describe('cash in and cash out', () => {
  const cfg = realConfig();
  it('adds and removes credits between rounds only', () => {
    const state = createState(cfg, 0);
    cashIn(state, 5000);
    expect(state.credits).toBe(5000);
    const r = playRound(cfg, state, new SeededRandom(1));
    expect(() => cashIn(state, 5000)).toThrow(/during a round/);
    expect(() => cashOut(state)).toThrow(/during a round/);
    settleRound(state, r);
    const out = cashOut(state);
    expect(out).toBe(5000 - cfg.bet + r.totalWin);
    expect(state.credits).toBe(0);
    expect(() => cashIn(state, 0)).toThrow(RangeError);
  });
});

describe('MB values', () => {
  const cfg = realConfig();
  it('draws a value for every landed MB and locks those same values when Hold & Spin starts', () => {
    const state = createState(cfg, BIG);
    const src = new SeededRandom(8);
    let checked = 0;
    for (let i = 0; i < 20_000; i++) {
      const r = playRound(cfg, state, src);
      settleRound(state, r);
      let last: Extract<GameEvent, { type: 'spin' }> | null = null;
      for (const e of r.events) {
        if (e.type === 'spin') {
          last = e;
          expect(e.mbPrizes.map((m) => m.cell)).toEqual(e.grid.flatMap((s, c) => (s === cfg.money ? [c] : [])));
        } else if (e.type === 'hnsStart') {
          expect(e.locks.map((l) => ({ cell: l.cell, prize: l.prize }))).toEqual(last!.mbPrizes);
          checked++;
        }
      }
    }
    expect(checked).toBeGreaterThan(100);
  });
});

describe('triggers', () => {
  it('awards 6 free games and 4000 cr for 5 SC1, on FG reels without scatters', () => {
    const cfg = customConfig((r) => {
      r.baseReels = [['SC1', 'F1', 'F2'], ['SC1', 'F3', 'F4'], ['SC1', 'F3', 'F4'], ['SC1', 'F3', 'F4'], ['SC1', 'F3', 'F4']];
      r.fgReels = solidReels('F1', 'F2', 'F3', 'F4', 'F5');
    });
    const state = createState(cfg, BIG);
    const result = playRound(cfg, state, new SeededRandom(1), { forceBaseStops: [0, 0, 0, 0, 0] });
    const [base, ...free] = ofType(result.events, 'spin');
    expect(base).toMatchObject({ scatterCount: 5, scatterPay: 4000, freeGamesAwarded: 6 });
    expect(free).toHaveLength(6);
    expect(free.map((f) => f.freeGame)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(ofType(result.events, 'freeGamesEnd')[0]).toMatchObject({ gamesPlayed: 6, total: 0 });
  });

  it('retriggers 6 more free games on 3+ SC1 during free games', () => {
    let n = 0;
    const cfg = customConfig((r) => {
      r.baseReels = [['SC1', 'F1', 'F2'], ['SC1', 'F1', 'F2'], ['SC1', 'F1', 'F2'], ['F3', 'F4', 'F5'], ['F3', 'F4', 'F5']];
      // FG reel 1 has one scatter stop out of 50, so retriggers are possible but finite.
      r.fgReels = [Array.from({ length: 50 }, (_, i) => (i === 0 ? 'SC1' : 'F1')), ['SC1', 'F2', 'F3'], ['SC1', 'F2', 'F3'], ['F4', 'F5', 'F4'], ['F4', 'F5', 'F4']];
    });
    for (let seed = 1; seed < 200; seed++) {
      const state = createState(cfg, BIG);
      const result = playRound(cfg, state, new SeededRandom(seed), { forceBaseStops: [0, 0, 0, 0, 0] });
      const free = ofType(result.events, 'spin').filter((s) => s.mode === 'free');
      const retriggers = free.filter((s) => s.freeGamesAwarded > 0).length;
      expect(free.length).toBe(6 + 6 * retriggers);
      if (retriggers) n++;
    }
    expect(n).toBeGreaterThan(0);
  });

  it.each([
    [1, 0, null],
    [0, 1, 'never'],
  ])('uses the 1–5 MB draw table (yes %i, no %i)', (yes, no, never) => {
    const cfg = customConfig((r) => {
      r.hnsTrigger = r.hnsTrigger.map((t) => ({ ...t, yes, no }));
      r.baseReels = [['MB', 'F1', 'F2'], ['F3', 'F4', 'F5'], ['F3', 'F4', 'F5'], ['F1', 'F2', 'F3'], ['F1', 'F2', 'F3']];
    });
    const result = playRound(cfg, createState(cfg, BIG), new SeededRandom(5), { forceBaseStops: [0, 0, 0, 0, 0] });
    const base = ofType(result.events, 'spin')[0];
    expect(base.mbCount).toBe(1);
    expect(base.hnsTrigger).toBe(never ? null : 'draw');
    expect(ofType(result.events, 'hnsStart')).toHaveLength(never ? 0 : 1);
  });

  it('auto-triggers on 6 MB', () => {
    const cfg = customConfig((r) => {
      r.hnsTrigger = r.hnsTrigger.map((t) => ({ ...t, yes: 0, no: 1 }));
      r.baseReels = [['MB', 'MB', 'MB'], ['MB', 'MB', 'MB'], ['F3', 'F4', 'F5'], ['F1', 'F2', 'F3'], ['F1', 'F2', 'F3']];
    });
    const result = playRound(cfg, createState(cfg, BIG), new SeededRandom(5));
    const start = ofType(result.events, 'hnsStart')[0];
    expect(start).toMatchObject({ trigger: 'auto', respins: 3 });
    expect(start.locks.map((l) => l.cell)).toEqual([0, 1, 2, 3, 4, 5]);
  });
});

describe('MB table draw', () => {
  const cfg = realConfig();

  it('draws Low/Mid/High about 85/10/5 per round', () => {
    const state = createState(cfg, BIG);
    const src = new SeededRandom(11);
    const counts = [0, 0, 0];
    const N = 100_000;
    for (let i = 0; i < N; i++) {
      const r = playRound(cfg, state, src);
      settleRound(state, r);
      counts[r.mbTable]++;
      for (const e of r.events) if ('mbTable' in e) expect(e.mbTable).toBe(r.mbTable);
    }
    [0.85, 0.1, 0.05].forEach((p, i) => expect(Math.abs(counts[i] - N * p)).toBeLessThan(4 * Math.sqrt(N * p * (1 - p))));
  });

  it('values every MB in the round from the drawn table, including in free games', () => {
    // Equal draw weights so every table gets exercised.
    const evenDraw = customConfig((r) => { r.mbTableDraw = r.mbTableDraw.map((d) => ({ ...d, weight: 1 })); });
    const state = createState(evenDraw, BIG);
    const src = new SeededRandom(3);
    const allowed = evenDraw.mbTables.map((t) => new Set(t.prizes.items.filter((p) => p.kind === 'credits').map((p) => (p as { credits: number }).credits)));
    let checked = 0;
    for (let i = 0; i < 20_000; i++) {
      const r = playRound(evenDraw, state, src);
      settleRound(state, r);
      for (const e of r.events) {
        const locks = e.type === 'hnsStart' ? e.locks : e.type === 'hnsRespin' ? e.newLocks : [];
        for (const l of locks) if (l.prize.kind === 'credits') { expect(allowed[r.mbTable].has(l.prize.credits)).toBe(true); checked++; }
      }
    }
    expect(checked).toBeGreaterThan(1000);
  });
});

describe('Grand jackpot', () => {
  it('pays the Grand immediately when the trigger spin shows 15 MB', () => {
    const cfg = customConfig((r) => { r.baseReels = solidReels('MB', 'MB', 'MB', 'MB', 'MB'); });
    const state = createState(cfg, BIG);
    const result = playRound(cfg, state, new SeededRandom(1));
    expect(ofType(result.events, 'hnsRespin')).toHaveLength(0);
    const end = ofType(result.events, 'hnsEnd')[0];
    expect(end.lockedCount).toBe(15);
    expect(end.grand).toBe(1_000_000); // reset 100,000,000 centi + 16 centi → floor to 1,000,000 cr
    expect(state.meters[cfg.grandJackpot]).toBe(100_000_000); // reset after paying
  });

  it('pays the Grand when Hold & Spin fills the screen', () => {
    // HnS reel of nothing but MB: the first respin fills every unweighted position, and the weighted one too.
    const cfg = customConfig((r) => {
      r.baseReels = [['MB', 'MB', 'MB'], ['MB', 'MB', 'MB'], ['F3', 'F4', 'F5'], ['F1', 'F2', 'F3'], ['F1', 'F2', 'F3']];
      r.hnsReel = [{ symbol: 'MB', weight: 1 }];
    });
    const result = playRound(cfg, createState(cfg, BIG), new SeededRandom(1));
    const end = ofType(result.events, 'hnsEnd')[0];
    expect(ofType(result.events, 'hnsRespin')).toHaveLength(1);
    expect(end.lockedCount).toBe(15);
    expect(end.grand).toBe(1_000_000);
  });
});

describe('Hold & Spin and round invariants over many seeded rounds', () => {
  const cfg = realConfig();
  const state = createState(cfg, BIG);
  const src = new SeededRandom(2024);
  let hnsSeen = 0;
  let fgSeen = 0;

  it('holds for 150,000 rounds', () => {
    for (let i = 0; i < 150_000; i++) {
      const r = playRound(cfg, state, src);
      settleRound(state, r);
      expect(breakdownTotal(r.breakdown)).toBe(r.totalWin);
      if (r.events.some((e) => e.type === 'freeGamesStart')) fgSeen++;

      let locked = new Set<number>();
      let respinsLeft = 0;
      for (const e of r.events) {
        if (e.type === 'hnsStart') {
          hnsSeen++;
          locked = new Set(e.locks.map((l) => l.cell));
          respinsLeft = e.respins;
          expect(respinsLeft).toBe(cfg.hnsRespins);
        } else if (e.type === 'hnsRespin') {
          checkRespin(cfg, e, locked, respinsLeft);
          for (const l of e.newLocks) locked.add(l.cell);
          respinsLeft = e.respinsLeft;
        } else if (e.type === 'hnsEnd') {
          expect(e.lockedCount).toBe(locked.size);
          expect(respinsLeft === 0 || locked.size === 15).toBe(true);
          expect(e.grand > 0).toBe(locked.size >= cfg.grandMbCount);
          expect(e.total).toBe(e.creditTotal + e.jackpotTotal + e.grand);
        }
      }
    }
    expect(hnsSeen).toBeGreaterThan(1000);
    expect(fgSeen).toBeGreaterThan(100);
  });
});

function checkRespin(cfg: GameConfig, e: HnsRespinEvent, locked: Set<number>, before: number) {
  const unlocked = [...Array(15).keys()].filter((c) => !locked.has(c));
  expect(e.landed.map((l) => l.cell)).toEqual(unlocked);
  expect(e.weightedCells).toHaveLength(Math.min(cfg.hnsWeightedPositions, unlocked.length));
  for (const c of e.weightedCells) expect(unlocked).toContain(c);
  const mbLanded = e.landed.filter((l) => l.symbol === cfg.money).map((l) => l.cell);
  expect(e.newLocks.map((l) => l.cell)).toEqual(mbLanded);
  expect(e.respinsLeft).toBe(e.newLocks.length ? cfg.hnsRespins : before - 1);
  for (const l of e.landed) expect(cfg.hnsReel[l.stop]).toBe(l.symbol);
}

