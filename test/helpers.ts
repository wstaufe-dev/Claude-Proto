import { readFileSync } from 'node:fs';
import { loadConfig, type GameConfig, type RawConfig } from '../src/engine/index.ts';

export function realRaw(): RawConfig {
  return JSON.parse(readFileSync(new URL('../math/proto_v2.config.json', import.meta.url), 'utf8')) as RawConfig;
}

export function realConfig(): GameConfig {
  return loadConfig(realRaw());
}

/** The real config with some tables replaced, for building exact scenarios. */
export function customConfig(patch: (raw: RawConfig) => void): GameConfig {
  const raw = realRaw();
  patch(raw);
  return loadConfig(raw);
}
