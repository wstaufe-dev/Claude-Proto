import { defineConfig } from 'vite';

export default defineConfig({
  root: 'web',
  base: './',
  server: { fs: { allow: ['..'] }, host: true },
  build: { outDir: '../dist', emptyOutDir: true, target: 'es2022' },
});
