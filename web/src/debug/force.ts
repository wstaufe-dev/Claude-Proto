/**
 * Debug preconditions: find base-game stops that set up a scenario. The
 * round is then played by the normal engine with those stops (MB values,
 * trigger draws and features are still drawn as usual).
 */
import { countSymbol, evaluateLines, windowFor, type GameConfig } from '../../../src/engine/index.ts';

export type Scenario = 'fg3' | 'fg5' | 'hns' | 'fg+hns' | 'bigwin';

interface Window { stop: number; sc: number; mb: number }

function windows(cfg: GameConfig, reel: number): Window[] {
  const strip = cfg.baseReels[reel];
  return strip.map((_, stop) => {
    let sc = 0, mb = 0;
    for (let r = 0; r < cfg.rows; r++) {
      const s = strip[(stop + r) % strip.length];
      if (s === cfg.scatter) sc++;
      if (s === cfg.money) mb++;
    }
    return { stop, sc, mb };
  });
}

const pick = <T>(xs: T[]): T => xs[Math.floor(Math.random() * xs.length)];

export function findStops(cfg: GameConfig, scenario: Scenario): number[] | null {
  const w = cfg.baseReels.map((_, r) => windows(cfg, r));
  const none = (r: number) => w[r].filter((x) => x.sc === 0 && x.mb === 0);
  const withSc = (r: number, needMb: boolean) => {
    const c = w[r].filter((x) => x.sc === 1);
    if (!needMb) return c.filter((x) => x.mb === 0);
    const max = Math.max(...c.map((x) => x.mb));
    return c.filter((x) => x.mb === max);
  };
  const choose = (lists: Window[][]) => (lists.every((l) => l.length) ? lists.map((l) => pick(l).stop) : null);

  switch (scenario) {
    case 'fg3': return choose(w.map((_, r) => (r < 3 ? withSc(r, false) : none(r))));
    case 'fg5': return choose(w.map((_, r) => withSc(r, false)));
    case 'hns':
      return around(w.map((_, r) => w[r].filter((x) => x.sc === 0)), cfg.hnsAutoTrigger, cfg.hnsAutoTrigger + 2);
    case 'fg+hns':
      return around(w.map((_, r) => (r < 3 ? w[r].filter((x) => x.sc === 1) : w[r].filter((x) => x.sc === 0))), cfg.hnsAutoTrigger, cfg.hnsAutoTrigger + 2);
    case 'bigwin': {
      let best: number[] | null = null;
      let bestPay = -1;
      for (let i = 0; i < 4000; i++) {
        const stops = cfg.baseReels.map((s) => Math.floor(Math.random() * s.length));
        const grid = windowFor(cfg, cfg.baseReels, stops);
        if (countSymbol(grid, cfg.money) || countSymbol(grid, cfg.scatter)) continue;
        const pay = evaluateLines(cfg, grid).reduce((a, x) => a + x.pay, 0);
        if (pay > bestPay) { bestPay = pay; best = stops; }
      }
      return best;
    }
  }
}

/** Random stops from the given windows whose MB total is within [lo, hi]. */
function around(lists: Window[][], lo: number, hi: number): number[] | null {
  for (let i = 0; i < 20000; i++) {
    const ws = lists.map((l) => pick(l));
    const n = ws.reduce((a, x) => a + x.mb, 0);
    if (n >= lo && n <= hi) return ws.map((x) => x.stop);
  }
  return null;
}

