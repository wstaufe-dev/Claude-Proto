/** Layout and palette. Portrait design resolution 720 × 1280; the stage scales to fit. */
export const DESIGN_W = 720;
export const DESIGN_H = 1280;

export const CELL_W = 136;
export const CELL_H = 112;
export const REELS = 5;
export const ROWS = 3;
export const GRID_W = CELL_W * REELS;
export const GRID_H = CELL_H * ROWS;
export const GRID_X = (DESIGN_W - GRID_W) / 2;
export const GRID_Y = 784;

/** The collection pot sits just above the reels, below open space under the meters. */
export const POT_X = DESIGN_W / 2;
export const POT_Y = 668;

export const C = {
  bgTop: 0x5a0f12,
  bgBottom: 0x1a0406,
  bgFreeTop: 0x14234f,
  bgFreeBottom: 0x050a1c,
  gold: 0xf3c95a,
  goldLight: 0xfff1b8,
  goldDark: 0x9a6a1c,
  red: 0xc8202a,
  redDark: 0x6e0c12,
  jade: 0x1fa37a,
  ink: 0x1a0505,
  cream: 0xf8ecd0,
  cellBg: 0x2a0709,
  cellBgFree: 0x0c1636,
};

export const FONT_CN = '"Ma Shan Zheng", "STKaiti", "KaiTi", "Noto Serif SC", serif';
export const FONT_TITLE = 'Cinzel, "Trajan Pro", Georgia, serif';
export const FONT_UI = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

/** Whole credits with thousands separators. */
export const credits = (n: number) => Math.floor(n).toLocaleString('en-US');

let denomCents = 1;
/** Sets the value of one credit in cents (from the game config). */
export const setDenomination = (cents: number) => { denomCents = cents; };
/** Credits shown as dollars at the game's denomination, e.g. 80 cr at 1¢ → "$0.80". */
export const money = (creditsAmount: number) =>
  '$' + ((Math.floor(creditsAmount) * denomCents) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
