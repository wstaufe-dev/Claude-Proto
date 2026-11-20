# Claude-Proto

A slot prototype built on a shared math engine. The playable game (PixiJS,
coming next) and the Monte Carlo simulator both call the same presentation-free
engine, so a reported return can't drift from what the player sees.

```
math/Proto_v2.xlsx            math workbook (source of truth for data)
math/proto_v2.config.json     raw export of the workbook (generated, committed)
docs/RULES.md                 game rules the engine implements
tools/export-config.ts        Excel → JSON exporter
src/engine/                   shared engine: config loader, RNG, evaluation, round transaction
src/sim/                      simulator, exact base-game analysis, statistics
test/                         unit, scenario, invariant and parity tests
```

## Commands

```sh
npm install                 # .npmrc sets legacy-peer-deps (works around an npm resolver bug)
npm run export-config       # after editing the workbook: validate and re-export JSON
npm test                    # 59 tests, a few seconds
npm run typecheck
npm run sim -- --rounds 10000000 --seed 1 [--workers 4]
```

The simulator prints return by source, with exact base-game figures alongside
for comparison, plus trigger frequencies, Hold & Spin statistics, volatility
and the win distribution. It writes the full report to `reports/` (ignored by
git). Results are reproducible for a given `(seed, workers, rounds)`.

## Engine contract

- **Data:** `loadConfig(raw)` validates the exported data and returns a typed
  config. It reports every problem at once, and the exporter refuses to write
  an invalid workbook.
- **Round transaction:** `playRound(cfg, state, rng)` takes the 80 cr wager,
  adds the progressive contributions, and plays the base spin, Hold & Spin and
  free games to completion. It returns ordered semantic events and a win
  breakdown.
- **Settlement:** `settleRound(state, result)` credits the win. It rejects a
  stale or duplicate result.
- **Random numbers:** a `RandomSource` only supplies uint32 values. The engine
  turns them into choices itself (unbiased `randInt`, cumulative weighted
  tables).
  - `SeededRandom` (xoshiro128**) is for simulation and replay.
  - `CryptoRandom` is for live play.
  - `ScriptedRandom` and `RecordingRandom` are for tests and transcripts.
- **Units:** awards are whole credits. Progressive meters are kept in
  centicredits.
