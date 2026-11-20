/** DOM debug panel: forced scenarios, MB table, RNG seed, turbo, session stats, transcripts. */
import type { GameConfig, RoundResult } from '../../../src/engine/index.ts';
import { credits } from '../art/theme.ts';
import type { Scenario } from './force.ts';

export interface DebugHooks {
  force(s: Scenario): void;
  setMbTable(i: number | undefined): void;
  setTurbo(on: boolean): void;
  setShowWeighted(on: boolean): void;
  useSeed(seed: number | null): void;
  addCredits(n: number): void;
}

export class DebugPanel {
  private readonly el = document.getElementById('debug')!;
  private readonly stats: HTMLElement;
  private readonly last: HTMLElement;
  private readonly pending: HTMLElement;
  private lastResult: RoundResult | null = null;
  private rounds = 0;
  private wagered = 0;
  private won = 0;

  constructor(private readonly cfg: GameConfig, hooks: DebugHooks) {
    const toggle = document.getElementById('debug-toggle')!;
    const flip = () => { this.el.hidden = !this.el.hidden; };
    toggle.addEventListener('click', flip);
    window.addEventListener('keydown', (e) => { if (e.key === 'd' || e.key === 'D') flip(); });

    const h = (t: string) => Object.assign(document.createElement('h3'), { textContent: t });
    const btn = (label: string, fn: () => void) => {
      const b = document.createElement('button');
      b.textContent = label;
      b.addEventListener('click', fn);
      return b;
    };
    const toggleBtn = (label: string, fn: (on: boolean) => void) => {
      const b = btn(label, () => { b.classList.toggle('on'); fn(b.classList.contains('on')); });
      return b;
    };

    this.el.append(h('Next spin'));
    this.pending = document.createElement('div');
    this.pending.style.cssText = 'color:#f3d27a;min-height:1.2em;margin-bottom:4px';
    const scenarios: [string, Scenario][] = [
      ['Free games (3 SC1)', 'fg3'], ['Free games (5 SC1)', 'fg5'], ['Hold & Spin (6+ MB)', 'hns'],
      ['FG + Hold & Spin', 'fg+hns'], ['Big line win', 'bigwin'],
    ];
    this.el.append(this.pending, ...scenarios.map(([l, s]) => btn(l, () => { hooks.force(s); this.pending.textContent = `Forced: ${l}`; })));

    this.el.append(h('MB table'));
    const sel = document.createElement('select');
    sel.append(new Option('Drawn (85/10/5)', ''), ...cfg.mbTables.map((t, i) => new Option(`Always ${t.name}`, String(i))));
    sel.addEventListener('change', () => hooks.setMbTable(sel.value === '' ? undefined : Number(sel.value)));
    this.el.append(sel);

    this.el.append(h('Presentation'));
    this.el.append(toggleBtn('Turbo', hooks.setTurbo), toggleBtn('Mark weighted HnS cell', hooks.setShowWeighted));

    this.el.append(h('Random numbers'));
    const seed = Object.assign(document.createElement('input'), { type: 'text', placeholder: 'seed' });
    const rngLabel = document.createElement('div');
    rngLabel.textContent = 'Live (crypto)';
    this.el.append(rngLabel, seed,
      btn('Use seed', () => { const n = Number(seed.value); if (Number.isFinite(n)) { hooks.useSeed(n); rngLabel.textContent = `Seeded: ${n}`; } }),
      btn('Live', () => { hooks.useSeed(null); rngLabel.textContent = 'Live (crypto)'; }));

    this.el.append(h('Credits'), btn('+10,000', () => hooks.addCredits(10_000)), btn('+100,000', () => hooks.addCredits(100_000)));

    this.el.append(h('Session'));
    this.stats = document.createElement('pre');
    this.el.append(this.stats);

    this.el.append(h('Last round'));
    this.last = document.createElement('pre');
    this.el.append(this.last, btn('Download transcript (JSON)', () => this.download()));
    this.render();
  }

  clearPending() {
    this.pending.textContent = '';
  }

  record(r: RoundResult) {
    this.lastResult = r;
    this.rounds++;
    this.wagered += r.bet;
    this.won += r.totalWin;
    this.render();
  }

  private render() {
    const rtp = this.wagered ? ((this.won / this.wagered) * 100).toFixed(1) + '%' : '-';
    this.stats.textContent = `Rounds  ${this.rounds}\nWagered ${credits(this.wagered)}\nWon     ${credits(this.won)}\nRTP     ${rtp}`;
    const r = this.lastResult;
    if (!r) { this.last.textContent = '-'; return; }
    const b = r.breakdown;
    const parts: [string, number][] = [
      ['Base lines', b.baseLines], ['Base scatter', b.baseScatter], ['FG lines', b.freeLines], ['FG scatter', b.freeScatter],
      ['HnS credits', b.hnsCreditsBase + b.hnsCreditsFree], ...this.cfg.jackpots.map((j, i) => [j.name, b.jackpots[i]] as [string, number]),
    ];
    this.last.textContent = `Round ${r.roundId}  MB table ${this.cfg.mbTables[r.mbTable].name}\n` +
      parts.filter(([, v]) => v > 0).map(([k, v]) => `${k.padEnd(13)}${credits(v)}`).join('\n') +
      `\nTotal        ${credits(r.totalWin)}\nEvents       ${r.events.length}`;
  }

  private download() {
    if (!this.lastResult) return;
    const blob = new Blob([JSON.stringify({ config: this.cfg.sourceSha256, round: this.lastResult }, null, 2)], { type: 'application/json' });
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `round-${this.lastResult.roundId}.json` });
    a.click();
    URL.revokeObjectURL(a.href);
  }
}
