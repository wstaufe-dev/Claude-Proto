/**
 * Pure evaluation: reel windows, line wins, scatter and money-ball counts.
 * Nothing here draws random numbers or touches state.
 *
 * Grid layout: grid[cell] with cell = reel * rows + row, row 0 = top.
 */
import type { GameConfig } from './config.ts';

export interface LineWin {
  /** 0-based line index into GameConfig.lines. */
  line: number;
  symbol: number;
  count: number;
  pay: number;
}

export const cellOf = (cfg: GameConfig, reel: number, row: number) => reel * cfg.rows + row;

/** The visible window for the given stops: each reel shows stop, stop+1, stop+2 (wrapping). */
export function windowFor(cfg: GameConfig, strips: number[][], stops: number[]): number[] {
  const grid = new Array<number>(cfg.reels * cfg.rows);
  for (let r = 0; r < cfg.reels; r++) {
    const s = strips[r];
    for (let row = 0; row < cfg.rows; row++) grid[r * cfg.rows + row] = s[(stops[r] + row) % s.length];
  }
  return grid;
}

/**
 * Left-to-right win for a sequence of symbols (one per reel).
 * The line symbol is the first non-wild; wilds substitute for line-paying
 * symbols only. Returns [symbol, count, pay]; pay 0 means no win.
 */
export function evaluateSequence(cfg: GameConfig, seq: ArrayLike<number>): [number, number, number] {
  const wild = cfg.wild;
  let sym = -1;
  let count = 0;
  for (let i = 0; i < seq.length; i++) {
    const s = seq[i];
    if (s === wild) { count++; continue; }
    if (sym === -1) { sym = s; count++; continue; }
    if (s === sym) { count++; continue; }
    break;
  }
  if (sym === -1) return [wild, count, cfg.linePay[wild][count]]; // all wild
  // A non-paying symbol (scatter, money ball) cannot form a line, and wilds don't substitute for it.
  const pay = cfg.linePay[sym][count];
  if (pay === 0) {
    // Leading wilds alone may still pay as wilds (zero in the current data, kept for generality).
    let lead = 0;
    while (lead < seq.length && seq[lead] === wild) lead++;
    return [wild, lead, cfg.linePay[wild][lead] ?? 0];
  }
  return [sym, count, pay];
}

export function evaluateLines(cfg: GameConfig, grid: number[]): LineWin[] {
  const wins: LineWin[] = [];
  const seq = new Array<number>(cfg.reels);
  const lines = cfg.lines;
  for (let l = 0; l < lines.length; l++) {
    const line = lines[l];
    for (let r = 0; r < cfg.reels; r++) seq[r] = grid[r * cfg.rows + line[r]];
    const [symbol, count, pay] = evaluateSequence(cfg, seq);
    if (pay > 0) wins.push({ line: l, symbol, count, pay });
  }
  return wins;
}

export function countSymbol(grid: number[], symbol: number): number {
  let n = 0;
  for (let i = 0; i < grid.length; i++) if (grid[i] === symbol) n++;
  return n;
}

export function cellsWith(grid: number[], symbol: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < grid.length; i++) if (grid[i] === symbol) out.push(i);
  return out;
}
