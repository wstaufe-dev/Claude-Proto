/** Glowing sparks that arc from a money ball up into the pot. */
import { Container, Sprite, type Texture } from 'pixi.js';
import type { Anim } from './anim.ts';

interface Point { x: number; y: number }

const TRAIL = 5;

export class Particles extends Container {
  constructor(private readonly glow: Texture, private readonly anim: Anim) {
    super();
  }

  /**
   * Sends a burst of sparks from `from` to `to`. Resolves when the last spark arrives.
   * `onArrive` fires once, when the first spark reaches the target.
   */
  burst(from: Point, to: Point, onArrive: () => void, opts: { count?: number; turbo?: boolean } = {}): Promise<void> {
    const count = opts.count ?? 14;
    const speed = opts.turbo ? 0.55 : 1;
    let arrived = false;
    const sparks = Array.from({ length: count }, (_, i) => {
      const delay = (i / count) * 220 * speed + Math.random() * 60;
      const dur = (720 + Math.random() * 260) * speed;
      // Control point: up and out to one side, so sparks fan out then converge.
      const side = (Math.random() - 0.5) * 360;
      const ctrl = { x: (from.x + to.x) / 2 + side, y: Math.min(from.y, to.y) - 60 - Math.random() * 140 };
      const start = { x: from.x + (Math.random() - 0.5) * 40, y: from.y + (Math.random() - 0.5) * 30 };
      const sprites = Array.from({ length: TRAIL }, (_, k) => {
        const s = new Sprite(this.glow);
        s.anchor.set(0.5);
        s.blendMode = 'add';
        s.tint = k === 0 ? 0xfff2c0 : 0xffb02a;
        s.alpha = 0;
        this.addChild(s);
        return s;
      });
      return { delay, dur, ctrl, start, sprites, size: 0.35 + Math.random() * 0.25 };
    });

    return new Promise((resolve) => {
      let t = 0;
      const stop = this.anim.loop((dt) => {
        t += dt;
        let alive = 0;
        for (const sp of sparks) {
          const u = (t - sp.delay) / sp.dur;
          if (u >= 1) {
            for (const s of sp.sprites) s.visible = false;
            if (!arrived) { arrived = true; onArrive(); }
            continue;
          }
          alive++;
          sp.sprites.forEach((s, k) => {
            const uk = u - k * 0.035;
            if (uk < 0) { s.alpha = 0; return; }
            const e = easeInOut(uk);
            const p = bezier(sp.start, sp.ctrl, to, e);
            s.position.set(p.x, p.y);
            s.alpha = (1 - k / TRAIL) * Math.min(1, uk * 6);
            s.scale.set(sp.size * (1 - k * 0.15) * (1 - 0.4 * e));
          });
        }
        if (alive === 0 || this.anim.skipping) {
          stop();
          for (const sp of sparks) for (const s of sp.sprites) s.destroy();
          if (!arrived) onArrive();
          resolve();
        }
      });
    });
  }
}

function bezier(a: Point, c: Point, b: Point, t: number): Point {
  const m = 1 - t;
  return { x: m * m * a.x + 2 * m * t * c.x + t * t * b.x, y: m * m * a.y + 2 * m * t * c.y + t * t * b.y };
}

function easeInOut(t: number) {
  return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
}
