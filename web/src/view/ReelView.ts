/**
 * One reel column. It scrolls the real strip and stops exactly on the stop
 * the engine chose: the presentation never picks outcomes itself.
 *
 * Money balls show their value, using pre-rendered coin textures. Landed MBs
 * show the value the engine drew; MBs that only scroll past show a cosmetic
 * value drawn (with replacement) from the round's MB table.
 *
 * Used for the 5 × 3 reels (3 visible rows) and for each Hold & Spin
 * position (1 visible row, with non-MB symbols dimmed).
 */
import { BlurFilter, Container, Sprite, type Texture } from 'pixi.js';
import type { CoinLabel } from '../art/symbols.ts';
import { CELL_H, CELL_W, ROWS } from '../art/theme.ts';
import { easeInCubic, easeOutBack, linear, type Anim } from './anim.ts';

export type { CoinLabel };

const SPEED = 30; // symbols per second at full speed
const SPIN_BLUR = 4; // light enough that coin values stay readable while spinning

export interface ReelArt {
  symbol(id: number): Texture;
  isMoney(id: number): boolean;
  coin(label: CoinLabel): Texture;
  /** A cosmetic label for an MB that scrolls past (not an outcome). */
  randomLabel(): CoinLabel;
}

export interface ReelOptions {
  /** Visible rows (3 for the main reels, 1 for a Hold & Spin position). */
  rows?: number;
  /** Alpha for non-MB symbols (1 = normal). Hold & Spin dims them heavily. */
  nonMoneyAlpha?: number;
}

export class ReelView extends Container {
  private strip: number[];
  private pos = 0;
  private readonly rows: number;
  private readonly nonMoneyAlpha: number;
  private readonly cells: Sprite[] = [];
  private readonly blur = new BlurFilter({ strengthX: 0, strengthY: 0, quality: 2 });
  /** Labels by strip index: engine values for the landed window, cosmetic ones elsewhere. */
  private labels = new Map<number, CoinLabel>();

  constructor(strip: number[], private readonly art: ReelArt, private readonly anim: Anim, opts: ReelOptions = {}) {
    super();
    this.strip = strip;
    this.rows = opts.rows ?? ROWS;
    this.nonMoneyAlpha = opts.nonMoneyAlpha ?? 1;
    for (let i = 0; i < this.rows + 2; i++) {
      const s = new Sprite();
      s.anchor.set(0.5);
      s.x = CELL_W / 2;
      this.cells.push(s);
      this.addChild(s);
    }
    this.filters = [this.blur];
    this.render();
  }

  /** Switch strip (base ↔ free games) showing `stop`. */
  setStrip(strip: number[], stop: number, landed?: (CoinLabel | null)[]) {
    this.strip = strip;
    this.pos = stop;
    this.labels.clear();
    if (landed) this.setLanded(stop, landed);
    this.render();
  }

  /** The display object at visible row 0..rows-1 (valid when stopped). */
  spriteAt(row: number): Sprite {
    return this.cells[row + 1];
  }

  private setLanded(stop: number, landed: (CoinLabel | null)[]) {
    landed.forEach((l, row) => { if (l) this.labels.set((stop + row) % this.strip.length, l); });
  }

  private labelFor(idx: number): CoinLabel {
    let l = this.labels.get(idx);
    if (!l) { l = this.art.randomLabel(); this.labels.set(idx, l); }
    return l;
  }

  private render() {
    const len = this.strip.length;
    const base = Math.floor(this.pos);
    const frac = this.pos - base;
    for (let i = 0; i < this.cells.length; i++) {
      const idx = (((base + i - 1) % len) + len) % len;
      const sym = this.strip[idx];
      const s = this.cells[i];
      s.y = (i - 1 - frac) * CELL_H + CELL_H / 2;
      s.scale.set(1);
      if (this.art.isMoney(sym)) {
        s.texture = this.art.coin(this.labelFor(idx));
        s.alpha = 1;
      } else {
        s.texture = this.art.symbol(sym);
        s.alpha = this.nonMoneyAlpha;
      }
    }
  }

  /**
   * Spin and land on `stop`, whose visible rows show `landed` labels (engine
   * values for MBs, null elsewhere). `distance` is how many symbols pass at full speed.
   */
  async spinTo(stop: number, landed: (CoinLabel | null)[], delayMs: number, distance: number, isAnticipating?: () => void) {
    await this.anim.wait(delayMs);
    // Wind up: nudge upward, then drop away.
    const p0 = this.pos;
    await this.anim.tween(110, (t) => { this.pos = p0 + 0.3 * t; this.render(); }, easeInCubic);
    // Full speed. The jump to the run-in position happens at speed, so it isn't visible.
    // Fresh cosmetic values for everything scrolling past; the engine's values for the landing window.
    this.labels.clear();
    this.setLanded(stop, landed);
    this.blur.strengthY = SPIN_BLUR;
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

  /** Immediately show `stop`. */
  snap(stop: number, landed?: (CoinLabel | null)[]) {
    this.pos = stop;
    this.blur.strengthY = 0;
    if (landed) { this.labels.clear(); this.setLanded(stop, landed); }
    this.render();
  }
}
