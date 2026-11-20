/** The 5 × 3 reel window: reels, win highlights, anticipation glow. */
import { Container, Graphics, type Sprite } from 'pixi.js';
import type { GameConfig, LineWin } from '../../../src/engine/index.ts';
import type { SymbolArt } from '../art/symbols.ts';
import { C, CELL_H, CELL_W, GRID_H, GRID_W, REELS, ROWS } from '../art/theme.ts';
import { easeInOutSine, type Anim } from './anim.ts';
import { ReelView } from './ReelView.ts';

export class GridView extends Container {
  readonly reels: ReelView[] = [];
  private readonly back = new Graphics();
  private readonly glow = new Graphics();
  private readonly lineLayer = new Graphics();
  private stops: number[];

  constructor(private readonly cfg: GameConfig, private readonly art: SymbolArt, private readonly anim: Anim) {
    super();
    this.stops = cfg.baseReels.map(() => 0);
    this.drawBack(false);
    this.addChild(this.back, this.glow);
    const tex = (s: number) => art.symbol(cfg.symbols[s]);
    for (let r = 0; r < REELS; r++) {
      const reel = new ReelView(cfg.baseReels[r], tex, anim);
      reel.x = r * CELL_W;
      const mask = new Graphics().rect(r * CELL_W, 0, CELL_W, GRID_H).fill(0xffffff);
      reel.mask = mask;
      this.addChild(mask, reel);
      this.reels.push(reel);
    }
    this.addChild(this.lineLayer);
  }

  drawBack(free: boolean) {
    const g = this.back.clear();
    g.roundRect(-14, -14, GRID_W + 28, GRID_H + 28, 18).fill(C.goldDark)
      .roundRect(-10, -10, GRID_W + 20, GRID_H + 20, 16).fill(free ? C.cellBgFree : C.cellBg)
      .roundRect(-14, -14, GRID_W + 28, GRID_H + 28, 18).stroke({ width: 3, color: C.gold });
    for (let r = 1; r < REELS; r++) g.moveTo(r * CELL_W, 0).lineTo(r * CELL_W, GRID_H).stroke({ width: 1, color: C.goldDark, alpha: 0.5 });
  }

  setMode(mode: 'base' | 'free') {
    const strips = mode === 'base' ? this.cfg.baseReels : this.cfg.fgReels;
    this.reels.forEach((reel, r) => reel.setStrip(strips[r], this.stops[r] % strips[r].length));
    this.drawBack(mode === 'free');
  }

  spriteAt(cell: number): Sprite {
    return this.reels[Math.floor(cell / ROWS)].spriteAt(cell % ROWS);
  }

  /** Spin all reels to `stops`. Adds anticipation when the scatter could still trigger. */
  async spin(stops: number[], grid: number[], turbo: boolean) {
    this.clearWins();
    const need = this.cfg.fgTriggerCount;
    const scatterBefore = (reel: number) => {
      let n = 0;
      for (let r = 0; r < reel; r++) for (let row = 0; row < ROWS; row++) if (grid[r * ROWS + row] === this.cfg.scatter) n++;
      return n;
    };
    let extra = 0;
    const spins = this.reels.map((reel, r) => {
      const anticipate = !turbo && scatterBefore(r) >= need - 1;
      if (anticipate) extra += 22;
      const distance = (turbo ? 6 : 12) + r * (turbo ? 2 : 5) + extra;
      return reel.spinTo(stops[r], r * (turbo ? 20 : 70), distance, anticipate ? () => this.showGlow(r) : undefined);
    });
    await Promise.all(spins);
    this.glow.clear();
    this.stops = stops.slice();
  }

  snapTo(stops: number[]) {
    this.reels.forEach((reel, r) => reel.snap(stops[r]));
    this.stops = stops.slice();
    this.glow.clear();
  }

  private showGlow(reel: number) {
    this.glow.clear().roundRect(reel * CELL_W + 2, -6, CELL_W - 4, GRID_H + 12, 12).fill({ color: C.gold, alpha: 0.18 })
      .roundRect(reel * CELL_W + 2, -6, CELL_W - 4, GRID_H + 12, 12).stroke({ width: 4, color: C.goldLight, alpha: 0.9 });
  }

  /** Draws the winning lines and pulses their symbols. */
  async showLineWins(wins: LineWin[], ms: number) {
    const g = this.lineLayer.clear();
    const cells = new Set<number>();
    for (const w of wins) {
      const rows = this.cfg.lines[w.line];
      const pts = rows.map((row, r) => [r * CELL_W + CELL_W / 2, row * CELL_H + CELL_H / 2] as const);
      g.moveTo(pts[0][0] - CELL_W / 2, pts[0][1]);
      for (const [x, y] of pts) g.lineTo(x, y);
      g.lineTo(pts[4][0] + CELL_W / 2, pts[4][1]);
      g.stroke({ width: 5, color: lineColor(w.line), alpha: 0.9, join: 'round', cap: 'round' });
      for (let r = 0; r < w.count; r++) cells.add(r * ROWS + rows[r]);
    }
    await this.pulse([...cells], ms);
  }

  async pulse(cells: number[], ms: number) {
    const sprites = cells.map((c) => this.spriteAt(c));
    await this.anim.tween(ms, (t) => {
      const s = 1 + 0.12 * Math.sin(t * Math.PI * 3) ** 2;
      for (const sp of sprites) sp.scale.set(s);
    }, easeInOutSine);
    for (const sp of sprites) sp.scale.set(1);
  }

  clearWins() {
    this.lineLayer.clear();
  }

  /** Dims every cell except `keep` (used when entering Hold & Spin). */
  dimExcept(keep: Set<number>, alpha: number) {
    for (let c = 0; c < REELS * ROWS; c++) this.spriteAt(c).alpha = keep.has(c) ? 1 : alpha;
  }
}

const LINE_COLORS = [0xffe066, 0xff6b6b, 0x6bffb0, 0x6bc5ff, 0xd27bff, 0xffa94d, 0xffffff];
const lineColor = (i: number) => LINE_COLORS[i % LINE_COLORS.length];
