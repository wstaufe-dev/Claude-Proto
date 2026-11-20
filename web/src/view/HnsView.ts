/**
 * Hold & Spin board: 15 positions over the reel window. Shows locked coins
 * with the values the engine assigned; unlocked positions spin and reveal
 * what the engine landed.
 */
import { Container, Graphics, Sprite, Text } from 'pixi.js';
import type { GameConfig, Lock } from '../../../src/engine/index.ts';
import type { SymbolArt } from '../art/symbols.ts';
import { C, CELL_H, CELL_W, credits, FONT_TITLE, REELS, ROWS } from '../art/theme.ts';
import { easeOutBack, easeOutCubic, linear, type Anim } from './anim.ts';

class Slot extends Container {
  readonly bg: Sprite;
  readonly coin: Sprite;
  readonly value: Text;
  readonly marker = new Graphics();
  locked = false;

  constructor(art: SymbolArt) {
    super();
    this.bg = new Sprite(art.emptyCell);
    this.coin = new Sprite(art.coin);
    this.coin.anchor.set(0.5);
    this.coin.position.set(CELL_W / 2, CELL_H / 2);
    this.coin.visible = false;
    this.value = new Text({
      text: '',
      style: {
        fontFamily: FONT_TITLE, fontSize: 26, fontWeight: '900', fill: C.cream,
        stroke: { color: C.ink, width: 5, join: 'round' }, padding: 8,
      },
    });
    this.value.anchor.set(0.5);
    this.value.position.set(CELL_W / 2, CELL_H / 2 + 2);
    this.addChild(this.bg, this.marker, this.coin, this.value);
  }
}

export class HnsView extends Container {
  private readonly slots: Slot[] = [];
  /** Show which position used the weighted strip (debug). */
  showWeighted = false;

  constructor(private readonly cfg: GameConfig, private readonly art: SymbolArt, private readonly anim: Anim) {
    super();
    for (let c = 0; c < REELS * ROWS; c++) {
      const s = new Slot(art);
      s.position.set(Math.floor(c / ROWS) * CELL_W, (c % ROWS) * CELL_H);
      this.slots.push(s);
      this.addChild(s);
    }
    this.visible = false;
  }

  reset() {
    for (const s of this.slots) {
      s.locked = false;
      s.coin.visible = false;
      s.value.text = '';
      s.marker.clear();
      s.coin.scale.set(1);
      s.alpha = 1;
    }
  }

  private dress(slot: Slot, lock: Lock) {
    slot.locked = true;
    slot.coin.visible = true;
    if (lock.prize.kind === 'credits') {
      slot.coin.texture = this.art.valueCoin;
      slot.value.text = credits(lock.amount);
      slot.value.style.fontSize = lock.amount >= 1000 ? 24 : 28;
    } else {
      slot.coin.texture = this.art.jackpotCoin(this.cfg.jackpots[lock.prize.jackpot].name);
      slot.value.text = '';
    }
  }

  /** Lock coins, revealing their values with a pop. */
  async lock(locks: Lock[], stagger = 120) {
    await Promise.all(locks.map(async (l, i) => {
      await this.anim.wait(i * stagger);
      const s = this.slots[l.cell];
      this.dress(s, l);
      await this.anim.tween(380, (t) => s.coin.scale.set(0.3 + 0.7 * t), easeOutBack);
    }));
  }

  /** Spin the unlocked positions, then land them (non-MB results show empty). */
  async respin(unlocked: number[], weightedCells: number[], turbo: boolean) {
    const spinning = unlocked.map((c) => this.slots[c]);
    for (const c of unlocked) {
      const s = this.slots[c];
      s.marker.clear();
      if (this.showWeighted && weightedCells.includes(c)) {
        s.marker.roundRect(8, 8, CELL_W - 16, CELL_H - 16, 10).stroke({ width: 3, color: 0xff4d4d });
      }
    }
    // Shimmer: ghost coins flicker through each spinning position.
    let t = 0;
    const stop = this.anim.loop((dt) => {
      t += dt;
      spinning.forEach((s, i) => {
        s.coin.visible = true;
        s.coin.texture = this.art.coin;
        s.coin.alpha = 0.15 + 0.15 * Math.sin(t / 40 + i);
        s.coin.y = CELL_H / 2 + ((t / 2 + i * 37) % CELL_H) - CELL_H / 2;
      });
    });
    await this.anim.wait(turbo ? 250 : 650);
    stop();
    for (const s of spinning) {
      s.coin.alpha = 1;
      s.coin.y = CELL_H / 2;
      s.coin.visible = false;
    }
  }

  /** Count each locked coin into the total in reading order, calling onAdd with each amount. */
  async collect(locks: Lock[], onAdd: (amount: number, lock: Lock) => void, turbo: boolean) {
    const order = locks.slice().sort((a, b) => (a.cell % ROWS) - (b.cell % ROWS) || a.cell - b.cell);
    for (const l of order) {
      const s = this.slots[l.cell];
      await this.anim.tween(turbo ? 70 : 200, (t) => s.coin.scale.set(1 + 0.25 * Math.sin(t * Math.PI)), linear);
      onAdd(l.amount, l);
      s.alpha = 0.55;
    }
    await this.anim.tween(200, () => {}, easeOutCubic);
  }
}
