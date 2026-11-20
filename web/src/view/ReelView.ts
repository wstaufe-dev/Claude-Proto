/**
 * One reel column. It scrolls the real strip and stops exactly on the stop
 * the engine chose: the presentation never picks outcomes itself.
 *
 * Money balls carry a value label. Landed MBs show the value the engine
 * drew; MBs that only scroll past show a cosmetic value from the round's table.
 */
import { BlurFilter, Container, Sprite, Text, type Texture } from 'pixi.js';
import { C, CELL_H, CELL_W, FONT_TITLE, ROWS } from '../art/theme.ts';
import { easeInCubic, easeOutBack, linear, type Anim } from './anim.ts';

const SPEED = 30; // symbols per second at full speed

/** What a money ball shows: a credit value, or a jackpot name. */
export type CoinLabel = { credits: number } | { jackpot: string };

export interface ReelArt {
  symbol(id: number): Texture;
  isMoney(id: number): boolean;
  jackpotCoin(name: string): Texture;
  /** A cosmetic label for an MB that scrolls past (not an outcome). */
  randomLabel(): CoinLabel;
}

class Cell extends Container {
  readonly sprite = new Sprite();
  readonly value: Text;
  constructor() {
    super();
    this.sprite.anchor.set(0.5);
    this.value = new Text({
      text: '',
      style: { fontFamily: FONT_TITLE, fontSize: 26, fontWeight: '900', fill: C.cream, stroke: { color: C.ink, width: 5, join: 'round' }, padding: 8 },
    });
    this.value.anchor.set(0.5);
    this.value.y = 2;
    this.addChild(this.sprite, this.value);
  }
}

export class ReelView extends Container {
  private strip: number[];
  private pos = 0;
  private readonly cells: Cell[] = [];
  private readonly blur = new BlurFilter({ strengthX: 0, strengthY: 0, quality: 2 });
  /** Labels by strip index: engine values for the landed window, cosmetic ones elsewhere. */
  private labels = new Map<number, CoinLabel>();

  constructor(strip: number[], private readonly art: ReelArt, private readonly anim: Anim) {
    super();
    this.strip = strip;
    for (let i = 0; i < ROWS + 2; i++) {
      const c = new Cell();
      c.x = CELL_W / 2;
      this.cells.push(c);
      this.addChild(c);
    }
    this.filters = [this.blur];
    this.render();
  }

  /** Switch to another strip set (base ↔ free games) showing `stop`. */
  setStrip(strip: number[], stop: number, landed?: (CoinLabel | null)[]) {
    this.strip = strip;
    this.pos = stop;
    this.labels.clear();
    if (landed) this.setLanded(stop, landed);
    this.render();
  }

  /** The display object at visible row 0..2 (valid when stopped). */
  spriteAt(row: number): Container {
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
      const c = this.cells[i];
      c.y = (i - 1 - frac) * CELL_H + CELL_H / 2;
      c.scale.set(1);
      c.alpha = 1;
      if (this.art.isMoney(sym)) {
        const l = this.labelFor(idx);
        if ('jackpot' in l) {
          c.sprite.texture = this.art.jackpotCoin(l.jackpot);
          c.value.text = '';
        } else {
          c.sprite.texture = this.art.symbol(sym);
          c.value.text = l.credits.toLocaleString('en-US');
          c.value.style.fontSize = l.credits >= 1000 ? 24 : 28;
        }
      } else {
        c.sprite.texture = this.art.symbol(sym);
        c.value.text = '';
      }
    }
  }

  /**
   * Spin and land on `stop`, whose three rows show `landed` labels (engine values
   * for MBs, null elsewhere). `distance` is how many symbols pass at full speed.
   */
  async spinTo(stop: number, landed: (CoinLabel | null)[], delayMs: number, distance: number, isAnticipating?: () => void) {
    await this.anim.wait(delayMs);
    // Wind up: nudge upward, then drop away.
    const p0 = this.pos;
    await this.anim.tween(110, (t) => { this.pos = p0 + 0.3 * t; this.render(); }, easeInCubic);
    // Full speed. The jump to the run-in position happens at speed, so it isn't visible.
    // New cosmetic values for everything scrolling past, and the engine's values for the landing window.
    this.labels.clear();
    this.setLanded(stop, landed);
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

  /** Immediately show `stop`. */
  snap(stop: number, landed?: (CoinLabel | null)[]) {
    this.pos = stop;
    this.blur.strengthY = 0;
    if (landed) { this.labels.clear(); this.setLanded(stop, landed); }
    this.render();
  }
}
