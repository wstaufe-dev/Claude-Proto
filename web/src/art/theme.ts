/** Layout and palette. Design resolution is 1280 × 720; the stage scales to fit. */
export const DESIGN_W = 1280;
export const DESIGN_H = 720;

export const CELL_W = 150;
export const CELL_H = 118;
export const REELS = 5;
export const ROWS = 3;
export const GRID_W = CELL_W * REELS;
export const GRID_H = CELL_H * ROWS;
export const GRID_X = (DESIGN_W - GRID_W) / 2;
export const GRID_Y = 168;

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
