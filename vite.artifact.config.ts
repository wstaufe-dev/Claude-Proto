import { defineConfig, mergeConfig } from 'vite';
import base from './vite.config.ts';

// Single-bundle build used to publish the game as one self-contained page.
export default mergeConfig(base, defineConfig({
  build: {
    outDir: '../dist-artifact',
    emptyOutDir: true,
    modulePreload: false,
    rollupOptions: { output: { inlineDynamicImports: true } },
  },
}));
