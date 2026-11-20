import { parentPort, workerData } from 'node:worker_threads';
import { loadConfigFile } from './load.ts';
import { runRounds } from './run.ts';

const { configPath, seed, stream, rounds } = workerData as { configPath: string; seed: number; stream: number; rounds: number };
const cfg = loadConfigFile(configPath);
const stats = runRounds(cfg, seed, stream, rounds, (n) => parentPort!.postMessage({ type: 'progress', n }));
parentPort!.postMessage({ type: 'done', stats });
