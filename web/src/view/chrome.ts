/** Background, title, jackpot meters, message bar, banner and HUD (portrait layout). */
import { Container, FillGradient, Graphics, Text } from 'pixi.js';
import { C, credits, DESIGN_H, DESIGN_W, FONT_TITLE, FONT_UI, GRID_H, GRID_Y } from '../art/theme.ts';
import { easeOutBack, easeOutCubic, linear, type Anim } from './anim.ts';

const vgrad = (a: number, b: number) =>
  new FillGradient({ type: 'linear', start: { x: 0, y: 0 }, end: { x: 0, y: 1 }, colorStops: [{ offset: 0, color: a }, { offset: 1, color: b }], textureSpace: 'local' });

const goldStyle = (size: number, family = FONT_TITLE) => ({
  fontFamily: family, fontSize: size, fontWeight: '900' as const,
  fill: new FillGradient({ type: 'linear', start: { x: 0, y: 0 }, end: { x: 0, y: 1 }, colorStops: [{ offset: 0, color: C.goldLight }, { offset: 0.55, color: C.gold }, { offset: 1, color: C.goldDark }], textureSpace: 'local' }),
  stroke: { color: C.ink, width: Math.max(3, size / 10), join: 'round' as const },
  dropShadow: { color: 0x000000, alpha: 0.7, blur: 6, distance: 4, angle: Math.PI / 2 },
  padding: 16,
});

/** Night sky with a moon, distant hills and hanging lanterns. Drawn in code. */
export class Background extends Container {
  private readonly g = new Graphics();
  private readonly lanterns = new Container();
  private sway?: () => void;

  constructor(private readonly anim: Anim) {
    super();
    this.addChild(this.g, this.lanterns);
    this.draw(false);
    for (const [x, len, s] of [[46, 300, 1], [118, 220, 0.8], [DESIGN_W - 46, 300, 1], [DESIGN_W - 118, 220, 0.8]] as const) {
      this.lanterns.addChild(lantern(x, len, s));
    }
    let t = 0;
    this.sway = anim.loop((dt) => {
      t += dt / 1000;
      this.lanterns.children.forEach((l, i) => (l.rotation = Math.sin(t * 0.9 + i * 1.7) * 0.025));
    });
  }

  draw(free: boolean) {
    const g = this.g.clear();
    g.rect(0, 0, DESIGN_W, DESIGN_H).fill(free ? vgrad(C.bgFreeTop, C.bgFreeBottom) : vgrad(0x3a0a2a, 0x12030a));
    // Moon and its glow in the open space under the meters
    g.circle(DESIGN_W * 0.7, 360, 120).fill({ color: free ? 0x8fb4ff : 0xffd98a, alpha: 0.08 });
    g.circle(DESIGN_W * 0.7, 360, 64).fill(new FillGradient({
      type: 'radial', center: { x: 0.38, y: 0.35 }, innerRadius: 0, outerCenter: { x: 0.5, y: 0.5 }, outerRadius: 0.55,
      colorStops: [{ offset: 0, color: free ? 0xf4f8ff : 0xfff8e0 }, { offset: 0.7, color: free ? 0xc8d6f5 : 0xf2d9a0 }, { offset: 1, color: free ? 0x9fb4e0 : 0xd9b56a }],
      textureSpace: 'local',
    }));
    for (const [dx, dy, r] of [[-18, -10, 10], [14, 16, 7], [20, -22, 5]]) g.circle(DESIGN_W * 0.7 + dx, 360 + dy, r).fill({ color: 0x000000, alpha: 0.06 });
    // Hills
    g.moveTo(0, 560).bezierCurveTo(140, 470, 260, 540, 360, 500).bezierCurveTo(470, 460, 600, 540, DESIGN_W, 480).lineTo(DESIGN_W, DESIGN_H).lineTo(0, DESIGN_H).closePath()
      .fill({ color: free ? 0x0b1430 : 0x2a0716, alpha: 0.9 });
    g.moveTo(0, 620).bezierCurveTo(180, 560, 300, 620, 420, 590).bezierCurveTo(540, 560, 640, 610, DESIGN_W, 590).lineTo(DESIGN_W, DESIGN_H).lineTo(0, DESIGN_H).closePath()
      .fill({ color: free ? 0x070d22 : 0x1c040e, alpha: 1 });
    // Glow behind the reels
    g.ellipse(DESIGN_W / 2, GRID_Y + GRID_H / 2, 420, 260).fill({ color: free ? 0x3a6bff : C.gold, alpha: 0.05 });
  }

  destroy() {
    this.sway?.();
    super.destroy({ children: true });
  }
}

function lantern(x: number, cord: number, s: number): Container {
  const c = new Container();
  c.position.set(x, 0);
  const g = new Graphics();
  g.moveTo(0, 0).lineTo(0, cord).stroke({ width: 2, color: C.goldDark });
  const y = cord + 40 * s;
  g.ellipse(0, y, 30 * s, 40 * s).fill({ color: 0xff7a2a, alpha: 0.25 });
  g.ellipse(0, y, 26 * s, 36 * s).fill(vgrad(0xff5a3a, 0xa80f1a));
  for (const k of [-0.55, 0, 0.55]) g.ellipse(k * 14 * s, y, 4 * s, 35 * s).stroke({ width: 1.2, color: 0x7a0a10, alpha: 0.7 });
  g.roundRect(-12 * s, y - 40 * s, 24 * s, 7 * s, 2).fill(C.gold);
  g.roundRect(-12 * s, y + 33 * s, 24 * s, 7 * s, 2).fill(C.gold);
  g.moveTo(0, y + 40 * s).lineTo(0, y + 62 * s).stroke({ width: 3, color: C.red });
  c.addChild(g);
  c.pivot.set(0, 0);
  return c;
}

export class Title extends Container {
  constructor() {
    super();
    const t = new Text({ text: 'GOLDEN FORTUNE', style: { ...goldStyle(34), letterSpacing: 5 } });
    t.anchor.set(0.5, 0);
    t.position.set(DESIGN_W / 2, 8);
    this.addChild(t);
  }
}

class Plaque extends Container {
  private readonly value: Text;
  constructor(readonly name: string, w: number, h: number, color: number, valueSize: number) {
    super();
    const bg = new Graphics()
      .roundRect(0, 0, w, h, 16).fill(C.goldDark)
      .roundRect(4, 4, w - 8, h - 8, 13).fill(vgrad(color, darken(color)))
      .roundRect(4, 4, w - 8, h - 8, 13).stroke({ width: 2, color: C.goldLight, alpha: 0.6 });
    const label = new Text({ text: name.toUpperCase(), style: { ...goldStyle(Math.round(valueSize * 0.55)), letterSpacing: 3 } });
    label.anchor.set(0.5, 0);
    label.position.set(w / 2, 4);
    this.value = new Text({ text: '', style: { fontFamily: FONT_TITLE, fontSize: valueSize, fontWeight: '900', fill: C.cream, stroke: { color: C.ink, width: 5 }, padding: 8 } });
    this.value.anchor.set(0.5);
    this.value.position.set(w / 2, h * 0.62);
    this.addChild(bg, label, this.value);
    this.pivot.set(w / 2, h / 2);
  }
  set(amount: number) {
    this.value.text = credits(amount);
  }
}

/** Grand across the top; Minor, Major, Mini in a row beneath it. */
export class Meters extends Container {
  private readonly plaques: Plaque[];
  constructor(private readonly names: string[], private readonly anim: Anim) {
    super();
    const colors: Record<string, number> = { Grand: 0xb8860b, Major: 0xb3202a, Minor: 0x1f5fb8, Mini: 0x17895f };
    const spec: Record<string, { x: number; y: number; w: number; h: number; size: number }> = {
      Grand: { x: DESIGN_W / 2, y: 112, w: 640, h: 96, size: 48 },
      Minor: { x: 128, y: 214, w: 204, h: 74, size: 30 },
      Major: { x: DESIGN_W / 2, y: 214, w: 232, h: 84, size: 34 },
      Mini: { x: DESIGN_W - 128, y: 214, w: 204, h: 74, size: 30 },
    };
    this.plaques = names.map((n) => {
      const s = spec[n] ?? spec.Mini;
      const p = new Plaque(n, s.w, s.h, colors[n] ?? 0x555555, s.size);
      p.position.set(s.x, s.y);
      this.addChild(p);
      return p;
    });
  }
  /** Meter values in centicredits, by jackpot index. */
  show(metersCenti: number[]) {
    metersCenti.forEach((m, i) => this.plaques[i]?.set(Math.floor(m / 100)));
  }
  async flash(jackpot: number) {
    const p = this.plaques[jackpot];
    if (!p) return;
    await this.anim.tween(900, (t) => p.scale.set(1 + 0.1 * Math.sin(t * Math.PI * 4) ** 2), linear);
    p.scale.set(1);
  }
}

export class MessageBar extends Container {
  private readonly text: Text;
  constructor() {
    super();
    this.text = new Text({ text: '', style: { ...goldStyle(28), letterSpacing: 2 } });
    this.text.anchor.set(0.5);
    this.text.position.set(DESIGN_W / 2, GRID_Y + GRID_H + 32);
    this.addChild(this.text);
  }
  set(msg: string) {
    this.text.text = msg;
  }
}

/** Big centred announcement over a dimmed screen. */
export class Banner extends Container {
  private readonly shade = new Graphics().rect(0, 0, DESIGN_W, DESIGN_H).fill({ color: 0x000000, alpha: 0.55 });
  private readonly title: Text;
  private readonly sub: Text;
  constructor(private readonly anim: Anim) {
    super();
    this.title = new Text({ text: '', style: { ...goldStyle(68), align: 'center', wordWrap: true, wordWrapWidth: DESIGN_W - 60, lineHeight: 74 } });
    this.sub = new Text({ text: '', style: { fontFamily: FONT_TITLE, fontSize: 44, fontWeight: '900', fill: C.cream, stroke: { color: C.ink, width: 6 }, padding: 10, align: 'center' } });
    this.title.anchor.set(0.5);
    this.sub.anchor.set(0.5);
    this.title.position.set(DESIGN_W / 2, DESIGN_H / 2 - 60);
    this.sub.position.set(DESIGN_W / 2, DESIGN_H / 2 + 50);
    this.addChild(this.shade, this.title, this.sub);
    this.visible = false;
  }
  async show(title: string, sub = '', ms = 1600) {
    this.title.text = title;
    this.sub.text = sub;
    this.visible = true;
    this.alpha = 1;
    await this.anim.tween(450, (t) => this.title.scale.set(0.3 + 0.7 * t), easeOutBack);
    await this.anim.wait(ms);
    await this.anim.tween(250, (t) => (this.alpha = 1 - t), easeOutCubic);
    this.visible = false;
  }
  /** Count a number up inside the banner. */
  async countUp(title: string, amount: number, ms: number) {
    this.title.text = title;
    this.visible = true;
    this.alpha = 1;
    this.title.scale.set(1);
    await this.anim.tween(ms, (t) => (this.sub.text = credits(amount * t)), easeOutCubic);
    this.sub.text = credits(amount);
    await this.anim.wait(900);
    await this.anim.tween(250, (t) => (this.alpha = 1 - t), easeOutCubic);
    this.visible = false;
  }
}

export class Hud extends Container {
  private readonly balance: Text;
  private readonly win: Text;
  readonly spinButton = new Container();
  readonly cashInButton: Container;
  readonly cashOutButton: Container;
  private readonly spinFace = new Graphics();
  private readonly spinLabel: Text;

  constructor(bet: number) {
    super();
    const y = DESIGN_H - 96;
    const bar = new Graphics().roundRect(12, y, DESIGN_W - 24, 84, 18).fill({ color: 0x000000, alpha: 0.5 }).roundRect(12, y, DESIGN_W - 24, 84, 18).stroke({ width: 2, color: C.goldDark });
    this.addChild(bar);
    const field = (label: string, x: number) => {
      const l = new Text({ text: label, style: { fontFamily: FONT_UI, fontSize: 13, fontWeight: '700', fill: C.gold, letterSpacing: 2 } });
      const v = new Text({ text: '', style: { fontFamily: FONT_TITLE, fontSize: 26, fontWeight: '900', fill: C.cream, padding: 6 } });
      l.anchor.set(0.5, 0); v.anchor.set(0.5, 0);
      l.position.set(x, y + 14); v.position.set(x, y + 36);
      this.addChild(l, v);
      return v;
    };
    this.balance = field('BALANCE', 92);
    field('BET', 206).text = credits(bet);
    this.win = field('WIN', 326);

    const pill = (label: string, cy: number) => {
      const b = new Container();
      const g = new Graphics().roundRect(-56, -15, 112, 30, 15).fill(vgrad(0x4a1a12, 0x2a0a08)).roundRect(-56, -15, 112, 30, 15).stroke({ width: 2, color: C.gold });
      const t = new Text({ text: label, style: { fontFamily: FONT_UI, fontSize: 13, fontWeight: '800', fill: C.goldLight, letterSpacing: 1.5 } });
      t.anchor.set(0.5);
      b.addChild(g, t);
      b.position.set(486, cy);
      b.eventMode = 'static';
      b.cursor = 'pointer';
      this.addChild(b);
      return b;
    };
    this.cashInButton = pill('CASH IN', y + 24);
    this.cashOutButton = pill('CASH OUT', y + 60);

    this.spinButton.position.set(DESIGN_W - 82, y + 42);
    this.spinLabel = new Text({ text: 'SPIN', style: { ...goldStyle(22), letterSpacing: 1 } });
    this.spinLabel.anchor.set(0.5);
    this.spinButton.addChild(this.spinFace, this.spinLabel);
    this.spinButton.eventMode = 'static';
    this.spinButton.cursor = 'pointer';
    this.setSpinState('ready');
    this.addChild(this.spinButton);
  }

  setBalance(n: number) { this.balance.text = credits(n); }
  /** Cash buttons work only between rounds. */
  setCashEnabled(on: boolean) {
    for (const b of [this.cashInButton, this.cashOutButton]) { b.alpha = on ? 1 : 0.4; b.eventMode = on ? 'static' : 'none'; }
  }
  setWin(n: number) { this.win.text = n > 0 ? credits(n) : ''; }

  /** 'ready' = can spin, 'busy' = tap to speed up, 'disabled' = no credits. */
  setSpinState(s: 'ready' | 'busy' | 'disabled') {
    const color = s === 'ready' ? C.red : s === 'busy' ? 0x7a2a12 : 0x444444;
    this.spinFace.clear().circle(0, 0, 50).fill(C.goldDark).circle(0, 0, 45).fill(vgrad(lighten(color), color)).circle(0, 0, 45).stroke({ width: 3, color: C.gold });
    this.spinLabel.text = s === 'busy' ? 'SKIP' : 'SPIN';
    this.spinButton.alpha = s === 'disabled' ? 0.6 : 1;
  }
}

function darken(c: number) {
  return (((c >> 16) & 255) * 0.45) << 16 | (((c >> 8) & 255) * 0.45) << 8 | ((c & 255) * 0.45);
}
function lighten(c: number) {
  const f = (v: number) => Math.min(255, Math.round(v + (255 - v) * 0.35));
  return (f((c >> 16) & 255) << 16) | (f((c >> 8) & 255) << 8) | f(c & 255);
}
