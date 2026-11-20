import { defineConfig } from 'vitest/config';

// Tests run from the repository root (vite.config.ts sets root to web/ for the game).
export default defineConfig({ test: { root: '.', include: ['test/**/*.test.ts'] } });
