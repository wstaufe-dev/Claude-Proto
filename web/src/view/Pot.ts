/**
 * Golden collection bowl heaped with glowing orbs, drawn in code.
 * Money balls that land in the base game send particles into it.
 */
import { Container, FillGradient, Graphics, Sprite, type Renderer, type Texture } from 'pixi.js';
import { C, POT_X, POT_Y } from '../art/theme.ts';
import { easeOutCubic, type Anim } from './anim.ts';

const radial = (stops: [number, number][], cx = 0.38, cy = 0.32) =>
  new FillGradient({
    type: 'radial', center: { x: cx, y: cy }, innerRadius: 0, outerCenter: { x: 0.5, y: 0.5 }, outerRadius: 0.62,
    colorStops: stops.map(([offset, color]) => ({ offset, color })), textureSpace: 'local',
  });
const linear = (stops: [number, number][], horizontal = false) =>
  new FillGradient({
    type: 'linear', start: { x: 0, y: 0 }, end: horizontal ? { x: 1, y: 0 } : { x: 0, y: 1 },
    colorStops: stops.map(([offset, color]) => ({ offset, color })), textureSpace: 'local',
  });

/** Soft round glow, used for the pot halo and for particles. */
export function glowTexture(renderer: Renderer, radius = 32): Texture {
  const g = new Graphics();
  for (let i = 10; i >= 1; i--) g.circle(radius, radius, (radius * i) / 10).fill({ color: 0xffffff, alpha: 0.05 + (10 - i) * 0.012 });
  g.circle(radius, radius, radius * 0.22).fill({ color: 0xffffff, alpha: 0.9 });
  return renderer.generateTexture({ target: g, resolution: 2 });
}

export class Pot extends Container {
  private readonly halo: Sprite;
  private readonly body = new Container();
  private glowLevel = 0;
  /** Point the particles aim for (in the parent's coordinates). */
  readonly target = { x: POT_X, y: POT_Y - 26 };

  constructor(glow: Texture, private readonly anim: Anim) {
    super();
    this.position.set(POT_X, POT_Y);

    this.halo = new Sprite(glow);
    this.halo.anchor.set(0.5);
    this.halo.tint = 0xffc94a;
    this.halo.position.set(0, -30);
    this.halo.scale.set(5.2, 3.6);
    this.halo.alpha = 0.35;
    this.halo.blendMode = 'add';

    this.body.addChild(this.drawBowlBack(), this.drawOrbs(), this.drawBowlFront());
    this.addChild(this.halo, this.body);

    // Gentle idle shimmer
    let t = 0;
    anim.loop((dt) => {
      t += dt / 1000;
      this.glowLevel = Math.max(0, this.glowLevel - dt / 600);
      this.halo.alpha = 0.3 + 0.06 * Math.sin(t * 2) + 0.5 * this.glowLevel;
    });
  }

  private drawBowlBack(): Graphics {
    // Inside of the bowl (back rim)
    return new Graphics()
      .ellipse(0, 0, 138, 30).fill(linear([[0, 0x5a3608], [1, 0x2a1604]]));
  }

  private drawOrbs(): Graphics {
    const g = new Graphics();
    // Heap of coins and orbs rising above the rim (back to front, top to bottom)
    const rnd = mulberry(7);
    const items: { x: number; y: number; r: number; orb: boolean }[] = [];
    for (let row = 0; row < 5; row++) {
      const y = -66 + row * 15;
      const half = 40 + row * 22;
      const n = 3 + row * 2;
      for (let i = 0; i < n; i++) {
        const x = -half + (2 * half * (i + 0.5)) / n + (rnd() - 0.5) * 10;
        items.push({ x, y: y + (rnd() - 0.5) * 6, r: 13 + rnd() * 6, orb: rnd() < 0.45 });
      }
    }
    for (const it of items) {
      if (it.orb) {
        g.circle(it.x, it.y, it.r + 3).fill({ color: 0xffd36a, alpha: 0.25 });
        g.circle(it.x, it.y, it.r).fill(radial([[0, 0xffffff], [0.3, 0xffe58a], [0.75, 0xf0a020], [1, 0x8a4a08]]));
      } else {
        g.ellipse(it.x, it.y, it.r * 1.1, it.r * 0.7).fill(radial([[0, C.goldLight], [0.6, C.gold], [1, C.goldDark]]));
        g.ellipse(it.x, it.y, it.r * 1.1, it.r * 0.7).stroke({ width: 1.5, color: 0x6b4510 });
        g.ellipse(it.x, it.y, it.r * 0.5, it.r * 0.3).stroke({ width: 1.5, color: C.red, alpha: 0.7 });
      }
    }
    return g;
  }

  private drawBowlFront(): Graphics {
    const g = new Graphics();
    // Bowl body
    g.moveTo(-140, 0).bezierCurveTo(-136, 70, -80, 96, 0, 96).bezierCurveTo(80, 96, 136, 70, 140, 0)
      .bezierCurveTo(100, 24, -100, 24, -140, 0).closePath()
      .fill(linear([[0, 0x8a5a14], [0.25, C.goldLight], [0.5, C.gold], [0.8, 0xb07a1c], [1, 0x6b4510]], true));
    // Decorative band
    g.moveTo(-126, 34).bezierCurveTo(-60, 56, 60, 56, 126, 34).stroke({ width: 4, color: C.red, alpha: 0.85 });
    for (let i = -3; i <= 3; i++) g.circle(i * 30, 46 + (Math.abs(i) === 3 ? -6 : 0) - Math.abs(i) * 0.5, 4).fill(C.goldLight);
    // Front rim
    g.ellipse(0, 0, 140, 22).stroke({ width: 7, color: C.goldLight });
    g.ellipse(0, 0, 140, 22).stroke({ width: 2, color: 0x6b4510 });
    // Foot
    g.ellipse(0, 100, 62, 12).fill(linear([[0, C.gold], [1, 0x6b4510]]));
    return g;
  }

  /** A particle reached the pot. */
  absorb() {
    this.glowLevel = Math.min(1, this.glowLevel + 0.5);
    void this.anim.tween(260, (t) => this.body.scale.set(1 + 0.05 * Math.sin(t * Math.PI)), easeOutCubic);
  }
}

function mulberry(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
