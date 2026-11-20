import { describe, expect, it } from 'vitest';
import { ConfigError, loadConfig } from '../src/engine/index.ts';
import { realConfig, realRaw } from './helpers.ts';

describe('loadConfig on the exported workbook', () => {
  const cfg = realConfig();

  it('reads the expected shape', () => {
    expect(cfg.reels).toBe(5);
    expect(cfg.rows).toBe(3);
    expect(cfg.lines).toHaveLength(25);
    expect(cfg.baseReels.map((r) => r.length)).toEqual([65, 71, 65, 85, 83]);
    expect(cfg.fgReels).toEqual(cfg.baseReels);
    expect(cfg.hnsReel).toHaveLength(97);
    expect(cfg.bet).toBe(80);
  });

  it('maps pays and scatter pays', () => {
    expect(cfg.linePay[cfg.symbolId.M1].slice(3)).toEqual([10, 50, 150]);
    expect(cfg.linePay[cfg.wild].every((p) => p === 0)).toBe(true);
    expect(cfg.scatterPay).toEqual([0, 0, 0, 0, 400, 4000]);
  });

  it('turns progressive increments into whole centicredits per paid spin', () => {
    const byName = Object.fromEntries(cfg.jackpots.map((j) => [j.name, j]));
    expect(byName.Major).toMatchObject({ progressive: true, resetCenti: 5_000_000, incrementCenti: 56 });
    expect(byName.Grand).toMatchObject({ progressive: true, resetCenti: 100_000_000, incrementCenti: 16 });
    expect(byName.Mini).toMatchObject({ progressive: false, resetCenti: 100_000, incrementCenti: 0 });
  });

  it('has MB prizes including Mini/Minor/Major but not Grand', () => {
    const jp = cfg.mbPrizes.items.filter((p) => p.kind === 'jackpot').map((p) => cfg.jackpots[(p as { jackpot: number }).jackpot].name);
    expect(jp).toEqual(['Mini', 'Minor', 'Major']);
  });
});

describe('loadConfig validation', () => {
  const problemsFor = (patch: (raw: ReturnType<typeof realRaw>) => void): string[] => {
    const raw = realRaw();
    patch(raw);
    try {
      loadConfig(raw);
    } catch (e) {
      if (e instanceof ConfigError) return e.problems;
      throw e;
    }
    return [];
  };

  it('accepts the real config', () => expect(problemsFor(() => {})).toEqual([]));

  it.each([
    ['unknown reel symbol', (r: any) => (r.baseReels[2][5] = 'ZZ'), /Base Reel3 stop 6: unknown symbol ZZ/],
    ['duplicate line', (r: any) => (r.lines[24] = [...r.lines[0]]), /line 25 duplicates/],
    ['row out of range', (r: any) => (r.lines[3][2] = 3), /line 4 must have 5 row indices/],
    ['line count mismatch', (r: any) => r.lines.pop(), /table has 24 lines/],
    ['zero weight', (r: any) => (r.hnsReel[0].weight = 0), /HoldnSpin Reel stop 1: weight/],
    ['missing pay row', (r: any) => r.pays.splice(0, 1), /no row for symbol M1/],
    ['unknown MB jackpot', (r: any) => (r.mbTable[10].entry = 'Mega'), /unknown jackpot Mega/],
    ['Grand in MB table', (r: any) => (r.mbTable[10].entry = 'Grand'), /Grand is awarded by a full screen/],
    ['missing trigger row', (r: any) => r.hnsTrigger.pop(), /no row for 5 MB/],
    ['missing setting', (r: any) => delete r.settings['HnS Respins'], /"HnS Respins"/],
    ['fractional increment', (r: any) => (r.jackpots[2].incrementPct = 0.7001), /not a whole centicredit/],
  ])('reports %s', (_name, patch, message) => {
    expect(problemsFor(patch).join('\n')).toMatch(message);
  });

  it('reports every problem at once', () => {
    const problems = problemsFor((r) => { r.baseReels[0][0] = 'ZZ'; r.hnsReel[0].weight = -1; });
    expect(problems).toHaveLength(2);
  });
});
