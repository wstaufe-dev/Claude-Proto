/**
 * Random numbers.
 *
 * A RandomSource supplies only raw uint32 values. Turning those into
 * choices (randInt, weighted picks) is done here, so every consumer maps
 * random values to outcomes the same way.
 */

export interface RandomSource {
  /** A uniformly distributed integer in [0, 2^32). */
  nextUint32(): number;
}

const TWO_32 = 0x1_0000_0000;

/** Uniform integer in [0, bound), without modulo bias (rejection sampling). */
export function randInt(src: RandomSource, bound: number): number {
  if (!Number.isInteger(bound) || bound <= 0 || bound > TWO_32) throw new RangeError(`randInt: bad bound ${bound}`);
  const limit = TWO_32 - (TWO_32 % bound);
  for (;;) {
    const x = src.nextUint32();
    if (x < limit) return x % bound;
  }
}

/** Items with integer weights; pick() draws one with probability weight / total. */
export class WeightedTable<T> {
  readonly items: readonly T[];
  readonly weights: readonly number[];
  readonly total: number;
  private readonly cumulative: Float64Array;

  constructor(items: T[], weights: number[]) {
    if (items.length !== weights.length || items.length === 0) throw new Error('WeightedTable: items and weights must be non-empty and the same length');
    this.items = items;
    this.weights = weights;
    this.cumulative = new Float64Array(weights.length);
    let t = 0;
    weights.forEach((w, i) => {
      if (!Number.isInteger(w) || w <= 0) throw new Error(`WeightedTable: weight ${w} at ${i} must be a positive integer`);
      t += w;
      this.cumulative[i] = t;
    });
    this.total = t;
  }

  /** Index of the item a raw draw r in [0, total) selects. */
  indexFor(r: number): number {
    const c = this.cumulative;
    let lo = 0;
    let hi = c.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (r < c[mid]) hi = mid;
      else lo = mid + 1;
    }
    return lo;
  }

  pickIndex(src: RandomSource): number {
    return this.indexFor(randInt(src, this.total));
  }

  pick(src: RandomSource): T {
    return this.items[this.pickIndex(src)];
  }

  probability(i: number): number {
    return this.weights[i] / this.total;
  }
}

/** SplitMix32: used to expand a seed into generator state. */
function splitmix32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x9e3779b9) >>> 0;
    let z = s;
    z = Math.imul(z ^ (z >>> 16), 0x85ebca6b) >>> 0;
    z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35) >>> 0;
    return (z ^ (z >>> 16)) >>> 0;
  };
}

/**
 * xoshiro128** — fast, seedable, statistically strong (not cryptographic).
 * Used by the simulator and for reproducible game sessions.
 */
export class SeededRandom implements RandomSource {
  private a: number;
  private b: number;
  private c: number;
  private d: number;

  constructor(seed: number, stream = 0) {
    const sm = splitmix32((seed ^ Math.imul(stream + 1, 0x632be5ab)) >>> 0);
    this.a = sm(); this.b = sm(); this.c = sm(); this.d = sm();
    if ((this.a | this.b | this.c | this.d) === 0) this.a = 1;
  }

  nextUint32(): number {
    const result = Math.imul(rotl(Math.imul(this.b, 5), 7), 9) >>> 0;
    const t = this.b << 9;
    this.c ^= this.a;
    this.d ^= this.b;
    this.b ^= this.c;
    this.a ^= this.d;
    this.c ^= t;
    this.d = rotl(this.d, 11);
    return result;
  }
}

function rotl(x: number, k: number): number {
  return (x << k) | (x >>> (32 - k));
}

/** Uses the platform CSPRNG (browser or Node). For live play. */
export class CryptoRandom implements RandomSource {
  private buf = new Uint32Array(256);
  private i = this.buf.length;

  nextUint32(): number {
    if (this.i >= this.buf.length) {
      globalThis.crypto.getRandomValues(this.buf);
      this.i = 0;
    }
    return this.buf[this.i++];
  }
}

/**
 * Plays back a fixed list of raw values, then throws. Used by tests and
 * forced-outcome tools. Any value below the bound of the draw it feeds comes
 * out unchanged, so a script can list the intended integers directly.
 */
export class ScriptedRandom implements RandomSource {
  private i = 0;
  constructor(private readonly values: number[]) {}
  nextUint32(): number {
    if (this.i >= this.values.length) throw new Error(`ScriptedRandom: script exhausted after ${this.values.length} draws`);
    return this.values[this.i++] >>> 0;
  }
  get consumed(): number {
    return this.i;
  }
}

/** Wraps a source and records each raw value it hands out (for transcripts and replay). */
export class RecordingRandom implements RandomSource {
  readonly log: number[] = [];
  constructor(private readonly inner: RandomSource) {}
  nextUint32(): number {
    const v = this.inner.nextUint32();
    this.log.push(v);
    return v;
  }
}
