import { defineConfig } from 'vitest/config';

// Tests run from the repository root (vite.config.ts sets root to web/ for the game).
// Some tests play hundreds of thousands of rounds, so allow time on slower CI machines.
export default defineConfig({ test: { root: '.', include: ['test/**/*.test.ts'], testTimeout: 60_000 } });
