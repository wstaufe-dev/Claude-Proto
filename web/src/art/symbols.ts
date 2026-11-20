/**
 * Original placeholder art, drawn procedurally and baked into textures.
 *
 * Any symbol can be replaced by an image file listed in
 * web/public/assets/manifest.json, e.g.
 *   { "symbols": { "M1": "symbols/m1.png" }, "coin": "symbols/coin.png" }
 * Paths are relative to web/public/assets/. Missing entries fall back to the art here.
 */
import { Assets, Container, FillGradient, Graphics, Text, Texture, type Renderer } from 'pixi.js';
import { C, CELL_H, CELL_W, FONT_CN, FONT_TITLE } from './theme.ts';

export interface SymbolArt {
  /** Texture for a reel symbol by name (M1…F5, WW, SC1, MB). */
  symbol(name: string): Texture;
  /** Money-ball coin face (the value is drawn on top as text). */
  coin: Texture;
  /** Plain coin face that carries a credit value in Hold & Spin. */
  valueCoin: Texture;
  /** Coin plate for a jackpot MB (Mini/Minor/Major). */
  jackpotCoin(name: string): Texture;
  /** Empty Hold & Spin position. */
  emptyCell: Texture;
}

interface Manifest {
  symbols?: Record<string, string>;
  coin?: string;
  valueCoin?: string;
  jackpotCoins?: Record<string, string>;
  emptyCell?: string;
}

const W = CELL_W;
const H = CELL_H;

const vgrad = (stops: [number, number][]) =>
  new FillGradient({ type: 'linear', start: { x: 0, y: 0 }, end: { x: 0, y: 1 }, colorStops: stops.map(([offset, color]) => ({ offset, color })), textureSpace: 'local' });
const rgrad = (stops: [number, number][]) =>
  new FillGradient({
    type: 'radial', center: { x: 0.4, y: 0.35 }, innerRadius: 0, outerCenter: { x: 0.5, y: 0.5 }, outerRadius: 0.6,
    colorStops: stops.map(([offset, color]) => ({ offset, color })), textureSpace: 'local',
  });

const goldText = (text: string, size: number, family = FONT_TITLE, weight: '700' | '900' = '900') =>
  new Text({
    text,
    style: {
      fontFamily: family, fontSize: size, fontWeight: weight,
      fill: vgrad([[0, C.goldLight], [0.5, C.gold], [1, C.goldDark]]),
      stroke: { color: C.ink, width: Math.max(3, size / 12), join: 'round' },
      dropShadow: { color: 0x000000, alpha: 0.6, blur: 4, distance: 3, angle: Math.PI / 2 },
      padding: 12,
    },
  });

function center(t: Text, x = W / 2, y = H / 2) {
  t.anchor.set(0.5);
  t.position.set(x, y);
  return t;
}

/** Ornate tile with a Chinese character (high symbols). */
function charTile(ch: string, top: number, bottom: number): Container {
  const c = new Container();
  const pad = 8;
  const g = new Graphics()
    .roundRect(pad, pad, W - pad * 2, H - pad * 2, 16).fill(vgrad([[0, top], [1, bottom]]))
    .roundRect(pad, pad, W - pad * 2, H - pad * 2, 16).stroke({ width: 4, color: C.gold })
    .roundRect(pad + 7, pad + 7, W - (pad + 7) * 2, H - (pad + 7) * 2, 10).stroke({ width: 1.5, color: C.goldLight, alpha: 0.6 });
  // Corner knots
  for (const [x, y] of [[pad + 14, pad + 14], [W - pad - 14, pad + 14], [pad + 14, H - pad - 14], [W - pad - 14, H - pad - 14]]) {
    g.circle(x, y, 5).fill(C.gold).circle(x, y, 2).fill(bottom);
  }
  c.addChild(g, center(goldText(ch, 72, FONT_CN, '700'), W / 2, H / 2 + 2));
  return c;
}

/** Card-rank style low symbol. */
function rank(label: string, color: number): Container {
  const c = new Container();
  const g = new Graphics().ellipse(W / 2, H / 2 + 4, W * 0.34, H * 0.36).fill({ color, alpha: 0.18 });
  const t = new Text({
    text: label,
    style: {
      fontFamily: FONT_TITLE, fontSize: label.length > 1 ? 58 : 70, fontWeight: '900',
      fill: vgrad([[0, 0xffffff], [0.45, color], [1, darken(color, 0.45)]]),
      stroke: { color: C.ink, width: 6, join: 'round' },
      dropShadow: { color: 0x000000, alpha: 0.6, blur: 3, distance: 3, angle: Math.PI / 2 },
      padding: 12,
    },
  });
  c.addChild(g, center(t));
  return c;
}

function wild(): Container {
  const c = new Container();
  const g = new Graphics();
  // Golden burst
  const cx = W / 2, cy = H / 2, rays = 16;
  for (let i = 0; i < rays; i++) {
    const a = (i / rays) * Math.PI * 2;
    const b = a + Math.PI / rays;
    g.moveTo(cx, cy).lineTo(cx + Math.cos(a) * 80, cy + Math.sin(a) * 62).lineTo(cx + Math.cos(b) * 80, cy + Math.sin(b) * 62).closePath();
  }
  g.fill({ color: C.gold, alpha: 0.35 });
  g.roundRect(14, 34, W - 28, H - 68, 14).fill(vgrad([[0, 0xe5333d], [1, C.redDark]])).roundRect(14, 34, W - 28, H - 68, 14).stroke({ width: 4, color: C.gold });
  c.addChild(g, center(goldText('WILD', 40), W / 2, H / 2 + 1));
  return c;
}

function scatter(): Container {
  // Red envelope
  const c = new Container();
  const x = W * 0.22, y = 8, w = W * 0.56, h = H - 16;
  const g = new Graphics()
    .roundRect(x, y, w, h, 10).fill(vgrad([[0, 0xe63a3a], [1, 0x8e0f17]]))
    .roundRect(x, y, w, h, 10).stroke({ width: 3, color: C.gold })
    .moveTo(x, y + 10).quadraticCurveTo(W / 2, y + h * 0.5, x + w, y + 10).stroke({ width: 3, color: C.gold })
    .circle(W / 2, y + h * 0.42, 15).fill(vgrad([[0, C.goldLight], [1, C.goldDark]]))
    .circle(W / 2, y + h * 0.42, 15).stroke({ width: 2, color: C.ink });
  const fu = center(goldText('福', 20, FONT_CN, '700'), W / 2, y + h * 0.42 + 1);
  fu.style.stroke = { color: C.ink, width: 2 };
  c.addChild(g, fu, center(goldText('BONUS', 19), W / 2, y + h - 22));
  return c;
}

function coin(): Container {
  // Gold coin face with a dark centre, no hole, so a value reads cleanly on top of it.
  return valueCoin();
}

function valueCoin(): Container {
  // Solid gold face (no hole) so the value reads clearly.
  const c = new Container();
  const r = 50;
  c.addChild(new Graphics()
    .circle(W / 2, H / 2, r + 2).fill({ color: 0x000000, alpha: 0.35 })
    .circle(W / 2, H / 2, r).fill(rgrad([[0, C.goldLight], [0.55, C.gold], [1, C.goldDark]]))
    .circle(W / 2, H / 2, r).stroke({ width: 3, color: 0x6b4510 })
    .circle(W / 2, H / 2, r - 7).stroke({ width: 2, color: 0x8a5a14, alpha: 0.8 })
    .circle(W / 2, H / 2, r - 12).fill({ color: C.redDark, alpha: 0.85 }));
  return c;
}

function jackpotCoin(name: string): Container {
  const colors: Record<string, [number, number]> = {
    Mini: [0x3fd0a0, 0x0d5a42], Minor: [0x58a8ff, 0x123d7a], Major: [0xff6a5a, 0x7a0d12], Grand: [0xffe27a, 0x8a5a10],
  };
  const [a, b] = colors[name] ?? [0xffffff, 0x444444];
  const c = new Container();
  const r = 50;
  const g = new Graphics()
    .circle(W / 2, H / 2, r).fill(rgrad([[0, 0xffffff], [0.35, a], [1, b]]))
    .circle(W / 2, H / 2, r).stroke({ width: 4, color: C.gold })
    .circle(W / 2, H / 2, r - 8).stroke({ width: 1.5, color: C.goldLight, alpha: 0.7 });
  c.addChild(g, center(goldText(name.toUpperCase(), name.length > 4 ? 21 : 24), W / 2, H / 2));
  return c;
}

function emptyCell(): Container {
  const c = new Container();
  c.addChild(new Graphics()
    .roundRect(6, 6, W - 12, H - 12, 12).fill({ color: 0x000000, alpha: 0.35 })
    .roundRect(6, 6, W - 12, H - 12, 12).stroke({ width: 1.5, color: C.goldDark, alpha: 0.6 }));
  return c;
}

function darken(color: number, f: number): number {
  const r = ((color >> 16) & 255) * (1 - f), g = ((color >> 8) & 255) * (1 - f), b = (color & 255) * (1 - f);
  return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(b);
}

const PROCEDURAL: Record<string, () => Container> = {
  M1: () => charTile('福', 0xd62a2a, 0x6e0c12),
  M2: () => charTile('禄', 0x1d9b72, 0x0a4a36),
  M3: () => charTile('寿', 0x7d3bc0, 0x35145e),
  M4: () => charTile('喜', 0xe0781e, 0x7a3408),
  F1: () => rank('A', 0xff4d4d),
  F2: () => rank('K', 0x3fd0a0),
  F3: () => rank('Q', 0x5aa8ff),
  F4: () => rank('J', 0xc77dff),
  F5: () => rank('10', 0xffb347),
  WW: wild,
  SC1: scatter,
  MB: coin,
};

export async function createSymbolArt(renderer: Renderer): Promise<SymbolArt> {
  await document.fonts.ready;
  await Promise.all([document.fonts.load(`40px ${FONT_CN}`, '福禄寿喜'), document.fonts.load(`900 40px ${FONT_TITLE}`)]).catch(() => {});

  let manifest: Manifest = {};
  try {
    const res = await fetch('assets/manifest.json');
    if (res.ok) manifest = (await res.json()) as Manifest;
  } catch { /* no manifest: all procedural */ }

  const bake = (c: Container) => renderer.generateTexture({ target: c, resolution: 2, frame: undefined, antialias: true });
  const load = async (path: string | undefined, fallback: () => Container): Promise<Texture> => {
    if (path) {
      try { return await Assets.load<Texture>(`assets/${path}`); } catch (e) { console.warn(`Asset ${path} failed to load; using placeholder`, e); }
    }
    return bakeFixed(bake, fallback());
  };

  const symbols: Record<string, Texture> = {};
  for (const [name, make] of Object.entries(PROCEDURAL)) symbols[name] = await load(manifest.symbols?.[name], make);
  const coinTex = await load(manifest.coin, coin);
  const valueTex = await load(manifest.valueCoin, valueCoin);
  const jackpots: Record<string, Texture> = {};
  for (const n of ['Mini', 'Minor', 'Major', 'Grand']) jackpots[n] = await load(manifest.jackpotCoins?.[n], () => jackpotCoin(n));
  const empty = await load(manifest.emptyCell, emptyCell);

  return {
    symbol: (name) => symbols[name] ?? Texture.WHITE,
    coin: coinTex,
    valueCoin: valueTex,
    jackpotCoin: (name) => jackpots[name] ?? coinTex,
    emptyCell: empty,
  };
}

/** Bakes a cell-sized texture regardless of the content's own bounds (keeps every symbol aligned). */
function bakeFixed(bake: (c: Container) => Texture, content: Container): Texture {
  const frame = new Container();
  frame.addChild(new Graphics().rect(0, 0, W, H).fill({ color: 0x000000, alpha: 0.001 }), content);
  const mask = new Graphics().rect(0, 0, W, H).fill(0xffffff);
  frame.addChild(mask);
  content.mask = mask;
  return bake(frame);
}
