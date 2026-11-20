/**
 * One reel column. It scrolls the real strip and stops exactly on the stop
 * the engine chose: the presentation never picks symbols itself.
 */
import { BlurFilter, Container, Sprite, type Texture } from 'pixi.js';
import { CELL_H, CELL_W, ROWS } from '../art/theme.ts';
import { easeInCubic, easeOutBack, linear, type Anim } from './anim.ts';

const SPEED = 30; // symbols per second at full speed

export class ReelView extends Container {
  private strip: number[];
  private pos = 0;
  private readonly sprites: Sprite[] = [];
  private readonly blur = new BlurFilter({ strengthX: 0, strengthY: 0, quality: 2 });

  constructor(strip: number[], private readonly tex: (symbol: number) => Texture, private readonly anim: Anim) {
    super();
    this.strip = strip;
    for (let i = 0; i < ROWS + 2; i++) {
      const s = new Sprite();
      s.anchor.set(0.5);
      s.x = CELL_W / 2;
      this.sprites.push(s);
      this.addChild(s);
    }
    this.filters = [this.blur];
    this.render();
  }

  /** Switch to another strip set (base ↔ free games) showing `stop`. */
  setStrip(strip: number[], stop: number) {
    this.strip = strip;
    this.pos = stop;
    this.render();
  }

  /** Sprite showing visible row 0..2 (valid when stopped). */
  spriteAt(row: number): Sprite {
    return this.sprites[row + 1];
  }

  private render() {
    const len = this.strip.length;
    const base = Math.floor(this.pos);
    const frac = this.pos - base;
    for (let i = 0; i < this.sprites.length; i++) {
      const k = base + i - 1;
      const s = this.sprites[i];
      s.texture = this.tex(this.strip[((k % len) + len) % len]);
      s.y = (i - 1 - frac) * CELL_H + CELL_H / 2;
      s.scale.set(1);
      s.alpha = 1;
    }
  }

  /**
   * Spin and land on `stop`. `distance` is how many symbols pass at full speed;
   * a longer distance makes later reels stop later (and anticipation longer).
   */
  async spinTo(stop: number, delayMs: number, distance: number, isAnticipating?: () => void) {
    await this.anim.wait(delayMs);
    // Wind up: nudge upward, then drop away.
    const p0 = this.pos;
    await this.anim.tween(110, (t) => { this.pos = p0 + 0.3 * t; this.render(); }, easeInCubic);
    // Full speed. The jump to the run-in position happens at speed, so it isn't visible.
    this.blur.strengthY = 10;
    isAnticipating?.();
    const start = stop + distance + 0.5;
    const end = stop + 0.5;
    await this.anim.tween(((start - end) / SPEED) * 1000, (t) => { this.pos = start + (end - start) * t; this.render(); }, linear);
    this.blur.strengthY = 0;
    // Land with a small bounce.
    await this.anim.tween(300, (t) => { this.pos = end + (stop - end) * t; this.render(); }, easeOutBack);
    this.pos = stop;
    this.render();
  }

  /** Immediately show `stop` (used when skipping). */
  snap(stop: number) {
    this.pos = stop;
    this.blur.strengthY = 0;
    this.render();
  }
}
