import { Application, Container } from 'pixi.js';
import raw from '../../math/proto_v2.config.json';
import {
  cashIn, cashOut, createState, CryptoRandom, loadConfig, playRound, SeededRandom, settleRound,
  type RandomSource, type RawConfig, type RoundOptions,
} from '../../src/engine/index.ts';
import { createSymbolArt } from './art/symbols.ts';
import { DESIGN_H, DESIGN_W, GRID_X, GRID_Y } from './art/theme.ts';
import { findStops, type Scenario } from './debug/force.ts';
import { DebugPanel } from './debug/panel.ts';
import { Presenter } from './game/Presenter.ts';
import { Anim } from './view/anim.ts';
import { Background, Banner, Hud, MessageBar, Meters, Title } from './view/chrome.ts';
import { GridView } from './view/GridView.ts';
import { HnsView } from './view/HnsView.ts';

/** Credits added by Cash In, and loaded into the machine at start. */
const CASH_IN = 5_000;

const cfg = loadConfig(raw as RawConfig);
const state = createState(cfg, 0);
cashIn(state, CASH_IN);
let rng: RandomSource = new CryptoRandom();

const app = new Application();
await app.init({ background: '#120304', antialias: true, resolution: Math.min(window.devicePixelRatio, 2), autoDensity: true, resizeTo: window });
document.getElementById('stage')!.appendChild(app.canvas);

const root = new Container();
app.stage.addChild(root);
const fit = () => {
  const s = Math.min(app.screen.width / DESIGN_W, app.screen.height / DESIGN_H);
  root.scale.set(s);
  root.position.set((app.screen.width - DESIGN_W * s) / 2, (app.screen.height - DESIGN_H * s) / 2);
};
app.renderer.on('resize', fit);
fit();

const anim = new Anim(app.ticker);
const art = await createSymbolArt(app.renderer);

const background = new Background();
const grid = new GridView(cfg, art, anim);
const hns = new HnsView(cfg, art, anim);
grid.position.set(GRID_X, GRID_Y);
hns.position.set(GRID_X, GRID_Y);
const meters = new Meters(cfg.jackpots.map((j) => j.name), anim);
const message = new MessageBar();
const banner = new Banner(anim);
const hud = new Hud(cfg.bet);
root.addChild(background, new Title(), meters, grid, hns, message, hud, banner);

// Display-only starting position (not an outcome).
grid.snapTo(cfg.baseReels.map((s) => Math.floor(Math.random() * s.length)));
meters.show(state.meters);
hud.setBalance(state.credits);
message.set('PRESS SPIN TO PLAY');

const presenter = new Presenter(cfg, { background, grid, hns, meters, message, banner, hud }, anim);

let forced: Scenario | null = null;
let forcedTable: number | undefined;
let busy = false;

const panel = new DebugPanel(cfg, {
  force: (s) => { forced = s; },
  setMbTable: (i) => { forcedTable = i; },
  setTurbo: (on) => { presenter.turbo = on; anim.speed = on ? 2.5 : 1; },
  setShowWeighted: (on) => { hns.showWeighted = on; },
  useSeed: (seed) => { rng = seed === null ? new CryptoRandom() : new SeededRandom(seed); },
  addCredits: (n) => { state.credits += n; if (!busy) hud.setBalance(state.credits); refreshSpin(); },
});

function refreshSpin() {
  hud.setSpinState(busy ? 'busy' : state.credits >= cfg.bet ? 'ready' : 'disabled');
  hud.setCashEnabled(!busy);
}
refreshSpin();

async function spin() {
  if (busy) { anim.skipping = true; return; }
  if (state.credits < cfg.bet) { message.set(state.credits === 0 ? 'PRESS CASH IN TO PLAY' : 'INSUFFICIENT CREDITS'); return; }

  const opts: RoundOptions = { forceMbTable: forcedTable };
  if (forced) {
    const stops = findStops(cfg, forced);
    if (stops) opts.forceBaseStops = stops;
    else console.warn(`No stops found for scenario ${forced}`);
    forced = null;
    panel.clearPending();
  }

  const result = playRound(cfg, state, rng, opts);
  busy = true;
  refreshSpin();
  hud.setBalance(state.credits);
  try {
    await presenter.present(result);
  } finally {
    settleRound(state, result);
    anim.skipping = false;
    busy = false;
    hud.setBalance(state.credits);
    meters.show(state.meters);
    refreshSpin();
    panel.record(result);
  }
}

hud.spinButton.on('pointertap', () => void spin());
hud.cashInButton.on('pointertap', () => {
  if (busy) return;
  cashIn(state, CASH_IN);
  hud.setBalance(state.credits);
  hud.setWin(0);
  message.set(`CASHED IN ${CASH_IN.toLocaleString('en-US')}`);
  refreshSpin();
});
hud.cashOutButton.on('pointertap', async () => {
  if (busy || state.credits === 0) return;
  const amount = cashOut(state);
  hud.setBalance(0);
  hud.setWin(0);
  refreshSpin();
  await banner.countUp('CASHED OUT', amount, 1200);
  message.set('PRESS CASH IN TO PLAY');
});
window.addEventListener('keydown', (e) => {
  if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); void spin(); }
});

// For debugging in the console.
Object.assign(window, { game: { cfg, state } });
