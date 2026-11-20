# Claude-Proto

A slot prototype built on a shared math engine. The playable game (PixiJS) and the Monte Carlo simulator both call the same presentation-free
engine, so a reported return can't drift from what the player sees.

```
math/Proto_v2.xlsx            math workbook (source of truth for data)
math/proto_v2.config.json     raw export of the workbook (generated, committed)
docs/RULES.md                 game rules the engine implements
tools/export-config.ts        Excel → JSON exporter
web/                          PixiJS game (presentation adapter over the shared engine)
src/engine/                   shared engine: config loader, RNG, evaluation, round transaction
src/sim/                      simulator, exact base-game analysis, statistics
test/                         unit, scenario, invariant and parity tests
```

## Commands

```sh
npm install                 # .npmrc sets legacy-peer-deps (works around an npm resolver bug)
npm run export-config       # after editing the workbook: validate and re-export JSON
npm test                    # engine, simulator and parity tests (a few seconds)
npm run typecheck
npm run sim -- --rounds 10000000 --seed 1 [--workers 4]
npm run dev                 # play at http://localhost:5173 (Space = spin/skip, D = debug panel)
npm run build               # static build in dist/
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

## Playable game

The game in `web/` is an original East Asian theme ("Golden Fortune"), laid out in
portrait (720 × 1280 design size): jackpot meters at the top, a collection pot
above the reels that money-ball sparks fly into, and the reels at the bottom. It is made of
placeholder art drawn in code: 福 禄 寿 喜 tiles, A–10 ranks, a WILD plate,
a red-envelope BONUS scatter, and cash coins.

**Using real art.** List image files in `web/public/assets/manifest.json`.
Any symbol you leave out keeps its placeholder.

```json
{ "symbols": { "M1": "symbols/m1.png", "WW": "symbols/wild.png" },
  "coin": "symbols/coin.png", "valueCoin": "symbols/coin-plain.png",
  "jackpotCoins": { "Major": "symbols/major.png" }, "emptyCell": "symbols/empty.png" }
```

Images are cell-sized (136 × 112 design pixels) and are referenced relative to
`web/public/assets/`.

**Debug panel** (⚙ or the D key). Each scenario sets up the next spin; the
engine then plays the round normally.
- **Forced scenarios:** 3 SC1, 5 SC1, Hold & Spin, free games + Hold & Spin, a big line win.
- **MB table:** force Low, Mid or High.
- **Presentation:** turbo, and marking the weighted Hold & Spin position.
- **Random numbers:** seeded or live.
- **Credits:** add 10,000 or 100,000.
- **Session and last round:** session RTP and the last round's breakdown, with
  a download of the round transcript.

## Public hosting (GitHub Pages)

`.github/workflows/pages.yml` runs the tests, builds the game and publishes
`dist/` to GitHub Pages on every push. To set it up the first time, open the
repository's **Settings → Pages** and set **Source** to **GitHub Actions**.
After that, the game is at `https://wstaufe-dev.github.io/Claude-Proto/`.
