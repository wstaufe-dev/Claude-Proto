/**
 * Presentation adapter. Animates a RoundResult's events in order and shows
 * only values carried by those events; it never recalculates an outcome.
 */
import type { GameConfig, Lock, MbLanding, RoundResult } from '../../../src/engine/index.ts';
import { credits } from '../art/theme.ts';
import type { Anim } from '../view/anim.ts';
import type { Background, Banner, Hud, MessageBar, Meters } from '../view/chrome.ts';
import type { GridView } from '../view/GridView.ts';
import type { HnsView } from '../view/HnsView.ts';
import type { Particles } from '../view/Particles.ts';
import type { Pot } from '../view/Pot.ts';
import { CELL_H, CELL_W, GRID_X, GRID_Y, ROWS } from '../art/theme.ts';

export interface Views {
  background: Background;
  grid: GridView;
  hns: HnsView;
  meters: Meters;
  message: MessageBar;
  banner: Banner;
  hud: Hud;
  pot: Pot;
  particles: Particles;
}

export class Presenter {
  turbo = false;

  constructor(private readonly cfg: GameConfig, private readonly v: Views, private readonly anim: Anim) {}

  private get t() {
    return this.turbo || this.anim.skipping;
  }

  async present(result: RoundResult): Promise<void> {
    const { v, cfg } = this;
    v.meters.show(result.metersAtStart);
    v.hud.setWin(0);
    v.message.set(result.mbTable > 0 ? `${cfg.mbTables[result.mbTable].name.toUpperCase()} COIN VALUES` : '');

    let shown = 0;
    let fgTotal = 0;
    let baseStops: number[] = [];
    let baseMb: MbLanding[] = [];
    v.grid.setMbTable(result.mbTable);
    let locks: Lock[] = [];
    const addWin = (n: number) => { shown += n; v.hud.setWin(shown); };

    for (const e of result.events) {
      switch (e.type) {
        case 'spin': {
          if (e.mode === 'base') { baseStops = e.stops; baseMb = e.mbPrizes; }
          else v.message.set(`FREE GAME ${e.freeGame} OF ${fgTotal}`);
          // In the base game, each coin that lands sends sparks up into the pot as its reel stops.
          const flights: Promise<void>[] = [];
          const onReelStop = e.mode === 'base' && e.mbPrizes.length
            ? (reel: number) => {
              for (const m of e.mbPrizes) {
                if (Math.floor(m.cell / ROWS) !== reel) continue;
                const from = { x: GRID_X + reel * CELL_W + CELL_W / 2, y: GRID_Y + (m.cell % ROWS) * CELL_H + CELL_H / 2 };
                void v.grid.pulse([m.cell], 350);
                flights.push(v.particles.burst(from, v.pot.target, () => v.pot.absorb(), { turbo: this.t }));
              }
            }
            : undefined;
          await v.grid.spin(e.stops, e.grid, e.mbPrizes, this.t, onReelStop);
          await Promise.all(flights);
          if (e.lineWins.length) {
            addWin(e.lineTotal);
            if (e.mode === 'base') v.message.set(`WIN ${credits(e.lineTotal)}`);
            await v.grid.showLineWins(e.lineWins, this.t ? 400 : 1100);
          }
          if (e.scatterCount >= cfg.fgTriggerCount) {
            addWin(e.scatterPay);
            await v.grid.pulse(cellsOf(e.grid, cfg.scatter), this.t ? 400 : 1000);
            if (e.mode === 'free' && e.freeGamesAwarded) {
              fgTotal += e.freeGamesAwarded;
              await v.banner.show(`+${e.freeGamesAwarded} FREE GAMES`, e.scatterPay ? `+${credits(e.scatterPay)}` : '', this.t ? 400 : 1100);
            }
          }
          if (e.hnsTrigger) await v.grid.pulse(cellsOf(e.grid, cfg.money), this.t ? 400 : 1000);
          v.grid.clearWins();
          break;
        }

        case 'freeGamesStart':
          fgTotal = e.games;
          await v.banner.show('FREE GAMES', `${e.games} FREE GAMES`, this.t ? 500 : 1400);
          v.background.draw(true);
          v.grid.setMode('free', baseStops, baseMb);
          break;

        case 'freeGamesEnd':
          await v.banner.countUp('FREE GAMES WIN', e.total, this.t ? 400 : 1500);
          v.background.draw(false);
          v.grid.setMode('base', baseStops, baseMb);
          v.message.set('');
          break;

        case 'hnsStart':
          await v.banner.show('HOLD & SPIN', `${e.respins} RESPINS`, this.t ? 500 : 1300);
          locks = [...e.locks];
          v.hns.reset();
          v.hns.visible = true;
          v.grid.dimExcept(new Set(), 0);
          await v.hns.lock(e.locks, this.t ? 30 : 110);
          await this.jackpots(e.locks, e.meters);
          v.message.set(`RESPINS: ${e.respins}`);
          break;

        case 'hnsRespin': {
          const unlocked = e.landed.map((l) => l.cell);
          await v.hns.respin(unlocked, e.weightedCells, this.t);
          if (e.newLocks.length) {
            await v.hns.lock(e.newLocks, this.t ? 20 : 90);
            locks.push(...e.newLocks);
            await this.jackpots(e.newLocks, e.meters);
          }
          v.message.set(e.respinsLeft > 0 ? `RESPINS: ${e.respinsLeft}` : '');
          break;
        }

        case 'hnsEnd': {
          let running = 0;
          await v.hns.collect(locks, (amount) => { running += amount; v.message.set(`TOTAL ${credits(running)}`); }, this.t);
          if (e.grand > 0) {
            v.meters.show(e.meters);
            await v.banner.countUp('GRAND JACKPOT', e.grand, this.t ? 600 : 3000);
          }
          await v.banner.countUp('HOLD & SPIN WIN', e.total, this.t ? 400 : 1600);
          addWin(e.total);
          v.meters.show(e.meters);
          v.hns.visible = false;
          v.grid.dimExcept(new Set(Array.from({ length: 15 }, (_, i) => i)), 1);
          v.message.set('');
          break;
        }

        case 'roundEnd':
          if (shown !== e.totalWin) console.error(`Presentation showed ${shown} but the round paid ${e.totalWin}`);
          v.hud.setWin(e.totalWin);
          if (e.totalWin >= cfg.bet * 20 && !this.t) await v.banner.countUp(bigWinTitle(e.totalWin / cfg.bet), e.totalWin, 2200);
          v.message.set(e.totalWin > 0 ? `WIN ${credits(e.totalWin)}` : '');
          break;
      }
    }
  }

  private async jackpots(newLocks: Lock[], meters: number[]) {
    for (const l of newLocks) {
      if (l.prize.kind !== 'jackpot') continue;
      const name = this.cfg.jackpots[l.prize.jackpot].name;
      void this.v.meters.flash(l.prize.jackpot);
      await this.v.banner.show(`${name.toUpperCase()} JACKPOT`, credits(l.amount), this.t ? 400 : 1300);
    }
    this.v.meters.show(meters);
  }
}

function cellsOf(grid: number[], symbol: number): number[] {
  return grid.flatMap((s, i) => (s === symbol ? [i] : []));
}

function bigWinTitle(x: number): string {
  return x >= 100 ? 'MEGA WIN' : x >= 50 ? 'SUPER WIN' : 'BIG WIN';
}

