/**
 * Hold & Spin board: 15 positions over the reel window.
 *
 * Each open position is its own one-row reel over the Hold & Spin strip. It
 * spins and stops on the stop the engine chose. Non-MB symbols are shown but
 * heavily dimmed, and spinning coins show values from the round's MB table.
 * Locked positions show the coin with the value the engine assigned.
 */
import { Container, Graphics, Sprite } from 'pixi.js';
import type { GameConfig, Lock, MbPrize, WeightedTable } from '../../../src/engine/index.ts';
import type { SymbolArt } from '../art/symbols.ts';
import { CELL_H, CELL_W, REELS, ROWS } from '../art/theme.ts';
import { easeOutBack, easeOutCubic, linear, type Anim } from './anim.ts';
import { cosmeticLabel, prizeLabel } from './coins.ts';
import { ReelView, type ReelArt } from './ReelView.ts';

const DIM = 0.18;

class Slot extends Container {
  readonly bg: Sprite;
  readonly reel: ReelView;
  readonly coin = new Sprite();
  readonly marker = new Graphics();
  locked = false;

  constructor(art: SymbolArt, reelArt: ReelArt, strip: number[], anim: Anim) {
    super();
    this.bg = new Sprite(art.emptyCell);
    this.reel = new ReelView(strip, reelArt, anim, { rows: 1, nonMoneyAlpha: DIM });
    const mask = new Graphics().rect(0, 0, CELL_W, CELL_H).fill(0xffffff);
    this.reel.mask = mask;
    this.coin.anchor.set(0.5);
    this.coin.position.set(CELL_W / 2, CELL_H / 2);
    this.coin.visible = false;
    this.addChild(this.bg, mask, this.reel, this.marker, this.coin);
  }
}

export class HnsView extends Container {
  private readonly slots: Slot[] = [];
  private prizeTable: WeightedTable<MbPrize>;
  /** Show which position used the weighted strip (debug). */
  showWeighted = false;

  constructor(private readonly cfg: GameConfig, private readonly art: SymbolArt, private readonly anim: Anim) {
    super();
    this.prizeTable = cfg.mbTables[0].prizes;
    const reelArt: ReelArt = {
      symbol: (s) => art.symbol(cfg.symbols[s]),
      isMoney: (s) => s === cfg.money,
      coin: (l) => art.coinFor(l),
      randomLabel: () => cosmeticLabel(cfg, this.prizeTable),
    };
    for (let c = 0; c < REELS * ROWS; c++) {
      const s = new Slot(art, reelArt, cfg.hnsReel, anim);
      s.position.set(Math.floor(c / ROWS) * CELL_W, (c % ROWS) * CELL_H);
      this.slots.push(s);
      this.addChild(s);
    }
    this.visible = false;
  }

  /** Clears the board for a new Hold & Spin using MB table `mbTable`. */
  reset(mbTable: number) {
    this.prizeTable = this.cfg.mbTables[mbTable].prizes;
    // Open positions start on a non-MB stop: a coin there would look like one that has landed.
    const blanks = this.cfg.hnsReel.flatMap((sym, i) => (sym === this.cfg.money ? [] : [i]));
    for (const s of this.slots) {
      s.locked = false;
      s.coin.visible = false;
      s.coin.scale.set(1);
      s.marker.clear();
      s.alpha = 1;
      s.reel.visible = true;
      // Display-only starting position; each respin lands where the engine says.
      s.reel.setStrip(this.cfg.hnsReel, blanks[Math.floor(Math.random() * blanks.length)]);
    }
  }

  private dress(slot: Slot, lock: Lock) {
    slot.locked = true;
    slot.reel.visible = false;
    slot.marker.clear();
    slot.coin.texture = this.art.coinFor(prizeLabel(this.cfg, lock.prize));
    slot.coin.visible = true;
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

  /**
   * Spins every open position and stops each on the engine's stop. Positions
   * that land an MB show its engine value; it then locks.
   */
  async respin(landed: { cell: number; stop: number }[], newLocks: Lock[], weightedCells: number[], turbo: boolean) {
    const lockAt = new Map(newLocks.map((l) => [l.cell, l]));
    await Promise.all(landed.map(({ cell, stop }, i) => {
      const s = this.slots[cell];
      s.marker.clear();
      if (this.showWeighted && weightedCells.includes(cell)) {
        s.marker.roundRect(8, 8, CELL_W - 16, CELL_H - 16, 10).stroke({ width: 3, color: 0xff4d4d });
      }
      const l = lockAt.get(cell);
      const label = l ? prizeLabel(this.cfg, l.prize) : null;
      const reel = Math.floor(cell / ROWS);
      return s.reel.spinTo(stop, [label], (turbo ? 15 : 45) * reel + (turbo ? 0 : (i % 3) * 20), turbo ? 4 : 8 + reel * 2);
    }));
    if (newLocks.length) await this.lock(newLocks, turbo ? 20 : 90);
  }

  /** Count each locked coin into the total in reading order, calling onAdd with each amount. */
  async collect(locks: Lock[], onAdd: (amount: number, lock: Lock) => void, turbo: boolean) {
    for (const s of this.slots) if (!s.locked) s.reel.alpha = 0.4;
    const order = locks.slice().sort((a, b) => (a.cell % ROWS) - (b.cell % ROWS) || a.cell - b.cell);
    for (const l of order) {
      const s = this.slots[l.cell];
      await this.anim.tween(turbo ? 70 : 200, (t) => s.coin.scale.set(1 + 0.25 * Math.sin(t * Math.PI)), linear);
      onAdd(l.amount, l);
      s.alpha = 0.55;
    }
    await this.anim.tween(200, () => {}, easeOutCubic);
    for (const s of this.slots) s.reel.alpha = 1;
  }
}
