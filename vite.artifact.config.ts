import { fileURLToPath } from 'node:url';
import { defineConfig, mergeConfig } from 'vite';
import base from './vite.config.ts';

// Single-bundle build used to publish the game as one page. PixiJS is not
// bundled: the page loads it from a CDN and `pixi.js` resolves to the global.
export default mergeConfig(base, defineConfig({
  define: { 'import.meta.env.VITE_NO_DOWNLOADS': JSON.stringify('1') },
  resolve: { alias: { 'pixi.js': fileURLToPath(new URL('./web/src/pixi-global.ts', import.meta.url)) } },
  build: {
    outDir: '../dist-artifact',
    emptyOutDir: true,
    modulePreload: false,
    rollupOptions: { output: { inlineDynamicImports: true } },
  },
}));
