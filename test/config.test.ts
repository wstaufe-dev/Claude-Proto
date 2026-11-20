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
    expect(cfg.fgReels.map((r) => r.length)).toEqual([65, 71, 65, 85, 83]);
    expect(cfg.hnsReel).toHaveLength(100);
    expect(cfg.hnsReel.filter((s) => s === cfg.money)).toHaveLength(12); // 12% MB per unweighted position
    expect(cfg.bet).toBe(80);
    expect(cfg.denomCents).toBe(1);
  });

  it('maps pays and scatter pays', () => {
    expect(cfg.linePay[cfg.symbolId.M1].slice(3)).toEqual([40, 200, 600]);
    expect(cfg.linePay[cfg.wild].every((p) => p === 0)).toBe(true);
    expect(cfg.scatterPay).toEqual([0, 0, 0, 0, 400, 4000]);
  });

  it('turns progressive increments into whole centicredits per paid spin', () => {
    const byName = Object.fromEntries(cfg.jackpots.map((j) => [j.name, j]));
    expect(byName.Major).toMatchObject({ progressive: true, resetCenti: 5_000_000, incrementCenti: 56 });
    expect(byName.Grand).toMatchObject({ progressive: true, resetCenti: 100_000_000, incrementCenti: 16 });
    expect(byName.Mini).toMatchObject({ progressive: false, resetCenti: 100_000, incrementCenti: 0 });
  });

  it('has Low/Mid/High MB tables with Mini/Minor/Major but not Grand', () => {
    expect(cfg.mbTables.map((m) => m.name)).toEqual(['Low', 'Mid', 'High']);
    for (const { prizes } of cfg.mbTables) {
      const jp = prizes.items.filter((p) => p.kind === 'jackpot').map((p) => cfg.jackpots[(p as { jackpot: number }).jackpot].name);
      expect(jp).toEqual(['Mini', 'Minor', 'Major']);
    }
  });

  it('averages Mid ≈ 5× and High ≈ 20× the Low credit value, using the Low values', () => {
    const avgCredits = (i: number) => {
      const t = cfg.mbTables[i].prizes;
      let sum = 0, w = 0;
      t.items.forEach((p, k) => { if (p.kind === 'credits') { sum += p.credits * t.weights[k]; w += t.weights[k]; } });
      return sum / w;
    };
    expect(avgCredits(1) / avgCredits(0)).toBeCloseTo(5, 1);
    expect(avgCredits(2) / avgCredits(0)).toBeCloseTo(20, 1);
    const values = (i: number) => cfg.mbTables[i].prizes.items.map((p) => JSON.stringify(p));
    expect(values(1)).toEqual(values(0));
    expect(values(2)).toEqual(values(0));
  });

  it('draws Low/Mid/High 85/10/5', () => {
    expect(cfg.mbTableDraw.items.map((i) => cfg.mbTables[i].name)).toEqual(['Low', 'Mid', 'High']);
    expect(cfg.mbTableDraw.weights).toEqual([85, 10, 5]);
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
    ['unknown MB jackpot', (r: any) => (r.mbTables[1].rows[8].entry = 'Mega'), /MBPay Mid row 9: unknown jackpot Mega/],
    ['Grand in MB table', (r: any) => (r.mbTables[0].rows[10].entry = 'Grand'), /Grand is awarded by a full screen/],
    ['unknown table in draw', (r: any) => (r.mbTableDraw[2].name = 'Ultra'), /unknown table Ultra/],
    ['table missing from draw', (r: any) => r.mbTableDraw.pop(), /no row for table High/],
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
