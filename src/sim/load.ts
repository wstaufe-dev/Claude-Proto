import { readFileSync } from 'node:fs';
import { loadConfig, type GameConfig, type RawConfig } from '../engine/index.ts';

export const DEFAULT_CONFIG = 'math/proto_v2.config.json';

export function loadConfigFile(path = DEFAULT_CONFIG): GameConfig {
  return loadConfig(JSON.parse(readFileSync(path, 'utf8')) as RawConfig);
}
