import { describe, expect, it } from 'vitest';
import { randInt, ScriptedRandom, SeededRandom, WeightedTable } from '../src/engine/index.ts';

describe('randInt', () => {
  it('passes small raw values through unchanged', () => {
    expect(randInt(new ScriptedRandom([4]), 10)).toBe(4);
  });

  it('rejects raw values in the biased tail', () => {
    // For bound 3, 2^32 % 3 = 1, so the single value 2^32-1 must be rejected.
    const src = new ScriptedRandom([0xffffffff, 7]);
    expect(randInt(src, 3)).toBe(1);
    expect(src.consumed).toBe(2);
  });

  it('is roughly uniform', () => {
    const src = new SeededRandom(42);
    const counts = new Array(7).fill(0);
    const n = 700_000;
    for (let i = 0; i < n; i++) counts[randInt(src, 7)]++;
    const chi2 = counts.reduce((a, c) => a + (c - n / 7) ** 2 / (n / 7), 0);
    expect(chi2).toBeLessThan(22.5); // p ≈ 0.001 at 6 degrees of freedom
  });
});

describe('WeightedTable', () => {
  const t = new WeightedTable(['a', 'b', 'c'], [1, 1000, 2]);

  it('maps raw draws onto cumulative ranges', () => {
    expect(t.total).toBe(1003);
    expect(t.items[t.indexFor(0)]).toBe('a');
    expect(t.items[t.indexFor(1)]).toBe('b');
    expect(t.items[t.indexFor(1000)]).toBe('b');
    expect(t.items[t.indexFor(1001)]).toBe('c');
    expect(t.items[t.indexFor(1002)]).toBe('c');
  });

  it('rejects bad weights', () => {
    expect(() => new WeightedTable(['a'], [0])).toThrow();
    expect(() => new WeightedTable(['a'], [1.5])).toThrow();
  });
});

describe('SeededRandom', () => {
  const take = (s: SeededRandom, n: number) => Array.from({ length: n }, () => s.nextUint32());

  it('is reproducible', () => expect(take(new SeededRandom(7), 20)).toEqual(take(new SeededRandom(7), 20)));
  it('separates seeds and streams', () => {
    expect(take(new SeededRandom(7), 20)).not.toEqual(take(new SeededRandom(8), 20));
    expect(take(new SeededRandom(7, 0), 20)).not.toEqual(take(new SeededRandom(7, 1), 20));
  });
  it('returns uint32 values', () => {
    for (const v of take(new SeededRandom(1), 1000)) expect(Number.isInteger(v) && v >= 0 && v < 2 ** 32).toBe(true);
  });
});
