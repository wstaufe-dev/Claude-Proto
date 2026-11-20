/**
 * Used only by the artifact build: PixiJS is loaded from a CDN as a global
 * (window.PIXI) instead of being bundled into the page. Keep this list in
 * sync with the Pixi names the game imports.
 */
const P = (globalThis as unknown as { PIXI: typeof import('pixi.js') }).PIXI;
if (!P) throw new Error('PixiJS failed to load from the CDN');
export const { Application, Assets, BlurFilter, Container, FillGradient, Graphics, Sprite, Text, Texture } = P;
