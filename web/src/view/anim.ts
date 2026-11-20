/** Promise-based tweens on the Pixi ticker, with a global speed factor (turbo). */
import type { Ticker } from 'pixi.js';

export type Ease = (t: number) => number;
export const linear: Ease = (t) => t;
export const easeOutCubic: Ease = (t) => 1 - (1 - t) ** 3;
export const easeInCubic: Ease = (t) => t * t * t;
export const easeInOutSine: Ease = (t) => -(Math.cos(Math.PI * t) - 1) / 2;
export const easeOutBack: Ease = (t) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2;
};

export class Anim {
  /** Multiplies the passage of time: 1 = normal, 3 = turbo. */
  speed = 1;
  /** Set to skip all remaining animation of the current presentation (resolves tweens immediately). */
  skipping = false;

  constructor(private readonly ticker: Ticker) {}

  tween(ms: number, update: (t: number) => void, ease: Ease = easeOutCubic): Promise<void> {
    return new Promise((resolve) => {
      if (ms <= 0 || this.skipping) { update(1); resolve(); return; }
      let elapsed = 0;
      const step = (tk: Ticker) => {
        elapsed += tk.deltaMS * this.speed;
        const t = this.skipping ? 1 : Math.min(1, elapsed / ms);
        update(ease(t));
        if (t >= 1) {
          this.ticker.remove(step);
          resolve();
        }
      };
      this.ticker.add(step);
    });
  }

  wait(ms: number): Promise<void> {
    return this.tween(ms, () => {}, linear);
  }

  /** Runs `fn` every frame until the returned stop() is called. */
  loop(fn: (dtMs: number) => void): () => void {
    const step = (tk: Ticker) => fn(tk.deltaMS * this.speed);
    this.ticker.add(step);
    return () => this.ticker.remove(step);
  }
}

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
