/** Background, title, jackpot meters, message bar, banner and HUD. */
import { Container, FillGradient, Graphics, Text } from 'pixi.js';
import { C, credits, DESIGN_H, DESIGN_W, FONT_CN, FONT_TITLE, FONT_UI, GRID_H, GRID_Y } from '../art/theme.ts';
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

export class Background extends Container {
  private readonly g = new Graphics();
  constructor() {
    super();
    this.addChild(this.g);
    this.draw(false);
  }
  draw(free: boolean) {
    const g = this.g.clear();
    g.rect(0, 0, DESIGN_W, DESIGN_H).fill(free ? vgrad(C.bgFreeTop, C.bgFreeBottom) : vgrad(C.bgTop, C.bgBottom));
    // Lattice pattern
    const step = 48;
    for (let x = -DESIGN_H; x < DESIGN_W; x += step) {
      g.moveTo(x, 0).lineTo(x + DESIGN_H, DESIGN_H);
      g.moveTo(x + DESIGN_H, 0).lineTo(x, DESIGN_H);
    }
    g.stroke({ width: 1, color: C.gold, alpha: 0.05 });
    // Clouds of light behind the reels
    g.ellipse(DESIGN_W / 2, GRID_Y + GRID_H / 2, 520, 260).fill({ color: free ? 0x3a6bff : C.gold, alpha: 0.06 });
  }
}

export class Title extends Container {
  constructor() {
    super();
    const t = new Text({ text: 'GOLDEN FORTUNE', style: { ...goldStyle(30), letterSpacing: 6 } });
    t.anchor.set(0.5, 0);
    t.position.set(DESIGN_W / 2, 6);
    this.addChild(t);
  }
}

class Plaque extends Container {
  private readonly value: Text;
  private readonly bg = new Graphics();
  constructor(readonly name: string, private readonly w: number, color: number) {
    super();
    const h = 70;
    this.bg.roundRect(0, 0, w, h, 14).fill(vgrad(color, darken(color))).roundRect(0, 0, w, h, 14).stroke({ width: 3, color: C.gold });
    const label = new Text({ text: name.toUpperCase(), style: { ...goldStyle(18), letterSpacing: 3 } });
    label.anchor.set(0.5, 0);
    label.position.set(w / 2, 2);
    this.value = new Text({ text: '', style: { fontFamily: FONT_TITLE, fontSize: 28, fontWeight: '900', fill: C.cream, stroke: { color: C.ink, width: 4 }, padding: 8 } });
    this.value.anchor.set(0.5, 0);
    this.value.position.set(w / 2, 30);
    this.addChild(this.bg, label, this.value);
    this.pivot.set(w / 2, h / 2);
  }
  set(amount: number) {
    this.value.text = credits(amount);
  }
}

export class Meters extends Container {
  private readonly plaques: Plaque[];
  constructor(private readonly names: string[], private readonly anim: Anim) {
    super();
    const colors: Record<string, number> = { Grand: 0xb8860b, Major: 0xb3202a, Minor: 0x1f5fb8, Mini: 0x17895f };
    const order = ['Grand', 'Major', 'Minor', 'Mini'].filter((n) => names.includes(n));
    const widths = order.map((n) => (n === 'Grand' ? 300 : 220));
    const gap = 16;
    let x = (DESIGN_W - widths.reduce((a, b) => a + b, 0) - gap * (order.length - 1)) / 2;
    this.plaques = names.map(() => null as unknown as Plaque);
    order.forEach((n, i) => {
      const p = new Plaque(n, widths[i], colors[n] ?? 0x555555);
      p.position.set(x + widths[i] / 2, 52 + 35);
      x += widths[i] + gap;
      this.plaques[names.indexOf(n)] = p;
      this.addChild(p);
    });
  }
  /** Meter values in centicredits, by jackpot index. */
  show(metersCenti: number[]) {
    metersCenti.forEach((m, i) => this.plaques[i]?.set(Math.floor(m / 100)));
  }
  async flash(jackpot: number) {
    const p = this.plaques[jackpot];
    if (!p) return;
    await this.anim.tween(900, (t) => p.scale.set(1 + 0.15 * Math.sin(t * Math.PI * 4) ** 2), linear);
    p.scale.set(1);
  }
}

export class MessageBar extends Container {
  private readonly text: Text;
  constructor() {
    super();
    this.text = new Text({ text: '', style: { ...goldStyle(30), letterSpacing: 2 } });
    this.text.anchor.set(0.5);
    this.text.position.set(DESIGN_W / 2, GRID_Y + GRID_H + 46);
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
    this.title = new Text({ text: '', style: goldStyle(84) });
    this.sub = new Text({ text: '', style: { fontFamily: FONT_TITLE, fontSize: 40, fontWeight: '900', fill: C.cream, stroke: { color: C.ink, width: 6 }, padding: 10 } });
    this.title.anchor.set(0.5);
    this.sub.anchor.set(0.5);
    this.title.position.set(DESIGN_W / 2, DESIGN_H / 2 - 40);
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
  private readonly spinFace = new Graphics();
  private readonly spinLabel: Text;

  constructor(bet: number) {
    super();
    const y = DESIGN_H - 88;
    const bar = new Graphics().roundRect(40, y, DESIGN_W - 80, 72, 18).fill({ color: 0x000000, alpha: 0.45 }).roundRect(40, y, DESIGN_W - 80, 72, 18).stroke({ width: 2, color: C.goldDark });
    this.addChild(bar);
    const field = (label: string, x: number) => {
      const l = new Text({ text: label, style: { fontFamily: FONT_UI, fontSize: 14, fontWeight: '700', fill: C.gold, letterSpacing: 2 } });
      const v = new Text({ text: '', style: { fontFamily: FONT_TITLE, fontSize: 30, fontWeight: '900', fill: C.cream, padding: 6 } });
      l.anchor.set(0.5, 0); v.anchor.set(0.5, 0);
      l.position.set(x, y + 8); v.position.set(x, y + 28);
      this.addChild(l, v);
      return v;
    };
    this.balance = field('BALANCE', 230);
    field('BET', 520).text = credits(bet);
    this.win = field('WIN', 790);

    this.spinButton.position.set(DESIGN_W - 150, y + 36);
    this.spinLabel = new Text({ text: 'SPIN', style: { ...goldStyle(22), letterSpacing: 1 } });
    this.spinLabel.anchor.set(0.5);
    this.spinButton.addChild(this.spinFace, this.spinLabel);
    this.spinButton.eventMode = 'static';
    this.spinButton.cursor = 'pointer';
    this.setSpinState('ready');
    this.addChild(this.spinButton);

    const cn = new Text({ text: '福', style: { ...goldStyle(34, FONT_CN) } });
    cn.anchor.set(0.5);
    cn.position.set(92, y + 36);
    this.addChild(cn);
  }

  setBalance(n: number) { this.balance.text = credits(n); }
  setWin(n: number) { this.win.text = n > 0 ? credits(n) : ''; }

  /** 'ready' = can spin, 'busy' = tap to speed up, 'disabled' = no credits. */
  setSpinState(s: 'ready' | 'busy' | 'disabled') {
    const color = s === 'ready' ? C.red : s === 'busy' ? 0x7a2a12 : 0x444444;
    this.spinFace.clear().circle(0, 0, 46).fill(C.goldDark).circle(0, 0, 41).fill(vgrad(lighten(color), color)).circle(0, 0, 41).stroke({ width: 3, color: C.gold });
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
