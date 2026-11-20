import { describe, expect, it } from 'vitest';
import { evaluateLines, evaluateSequence, windowFor } from '../src/engine/index.ts';
import { realConfig } from './helpers.ts';

const cfg = realConfig();
const ids = (...names: string[]) => names.map((n) => cfg.symbolId[n]);
const pay = (...names: string[]) => evaluateSequence(cfg, ids(...names))[2];

describe('evaluateSequence (left to right, WW substitutes for M and F)', () => {
  // [sequence, winning symbol, count] — the expected pay is looked up in the config, so pay tuning doesn't break these.
  it.each([
    [['M1', 'M1', 'M1', 'M1', 'M1'], 'M1', 5],
    [['M1', 'M1', 'M1', 'M1', 'F1'], 'M1', 4],
    [['M1', 'M1', 'M1', 'F1', 'M1'], 'M1', 3],
    [['M1', 'M1', 'F1', 'M1', 'M1'], null, 0],
    [['F1', 'M1', 'M1', 'M1', 'M1'], null, 0],
    [['M2', 'WW', 'M2', 'WW', 'M2'], 'M2', 5],
    [['M3', 'WW', 'WW', 'F2', 'F2'], 'M3', 3],
    [['WW', 'WW', 'M2', 'M2', 'F1'], 'M2', 4],
    [['WW', 'WW', 'WW', 'WW', 'WW'], null, 0],
    [['SC1', 'SC1', 'SC1', 'SC1', 'SC1'], null, 0],
    [['MB', 'MB', 'MB', 'MB', 'MB'], null, 0],
    [['MB', 'WW', 'WW', 'M1', 'M1'], null, 0],
    [['F5', 'F5', 'F5', 'SC1', 'F5'], 'F5', 3],
  ] as [string[], string | null, number][])('%j wins %s ×%i', (seq, sym, count) => {
    const expected = sym ? cfg.linePay[cfg.symbolId[sym]][count] : 0;
    if (sym) expect(expected).toBeGreaterThan(0);
    expect(pay(...seq)).toBe(expected);
  });
});

describe('windowFor and evaluateLines', () => {
  it('shows stop, stop+1, stop+2 with wraparound', () => {
    const strips = cfg.baseReels;
    const stops = strips.map((s) => s.length - 1);
    const grid = windowFor(cfg, strips, stops);
    for (let r = 0; r < 5; r++) {
      const s = strips[r];
      expect(grid.slice(r * 3, r * 3 + 3)).toEqual([s[s.length - 1], s[0], s[1]]);
    }
  });

  it('pays every line on a full screen of one symbol', () => {
    const grid = new Array(15).fill(cfg.symbolId.M1);
    const wins = evaluateLines(cfg, grid);
    expect(wins).toHaveLength(25);
    expect(wins.reduce((a, w) => a + w.pay, 0)).toBe(25 * cfg.linePay[cfg.symbolId.M1][5]);
  });

  it('follows each line through its rows', () => {
    // Middle row M4 ×5, everything else F-mix: only lines on row 1 throughout win 5OAK.
    const grid = new Array(15).fill(0).map((_, c) => (c % 3 === 1 ? cfg.symbolId.M4 : cfg.symbolId[`F${(c % 5) + 1}`]));
    const wins = evaluateLines(cfg, grid).filter((w) => w.count === 5);
    expect(wins.map((w) => w.line)).toEqual([0]); // line 1 is 1-1-1-1-1
  });
});
