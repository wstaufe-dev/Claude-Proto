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
git). Results are reproducible for a given `(seed, workers, rounds)`. It also
writes the same report as tab-delimited text (`reports/sim-….txt`, copied to
`reports/sim-latest.txt`) for the Excel import.

## Windows tools (no command line)

Double-click files in the project folder:

| File | What it does |
|---|---|
| `Setup.bat` | One time (and after updating the project): checks Node.js and installs packages. |
| `Play Prototype.bat` | Starts the game and opens it in your browser. Keep its window open while playing; close it to stop. |
| `Run Simulation.bat` | Asks for rounds and seed, then simulates the exported math. |
| `Install Excel Tools.bat` | Adds (or refreshes) the macros and the Tools and Sim Results tabs in the workbook. Close Excel first. |

Buttons on the workbook's **Tools** tab:

| Button | What it does |
|---|---|
| Export Math Config | Saves the workbook and writes `math/proto_v2.config.json`. A running prototype reloads by itself. |
| Import Sim Results | Loads `reports/sim-latest.txt` into the **Sim Results** tab. |
| Import Other Results… | Loads an older report you pick from `reports/`. |

Typical loop: edit the math → **Export Math Config** → `Run Simulation.bat` →
**Import Sim Results** → `Play Prototype.bat`.

### First-time setup

1. Install Node.js (LTS) from https://nodejs.org with the default options.
2. **Before extracting a downloaded zip**, right-click it → Properties →
   tick **Unblock** → OK. Otherwise Windows warns about the `.bat` files and
   Excel blocks the macros.
3. Prefer a folder outside OneDrive (e.g. `C:\work\Claude-Proto`). OneDrive
   slows down `npm install` and can lock files.
4. Double-click `Setup.bat`.

### Adding the macros to the workbook (once)

The macro code lives in `tools/excel/ProtoTools.bas`, so changes to it can be
reviewed in git.

**Automatic:** close Excel and double-click `Install Excel Tools.bat`. It
opens the workbook in a hidden Excel, imports the macros, adds the **Tools**
and **Sim Results** tabs, and saves `math/Proto_v2.xlsm`. It needs Excel's
"Trust access to the VBA project object model" setting; if that is off, it
offers to turn it on only while it runs. Run it again after `ProtoTools.bas`
changes to refresh the macros in the `.xlsm`. Then do step 5 below.

**By hand:**

1. Open `math/Proto_v2.xlsx` in Excel.
2. Press **Alt+F11** to open the VBA editor → **File → Import File…** →
   choose `tools\excel\ProtoTools.bas`. Close the VBA editor.
3. Press **Alt+F8**, choose **InstallToolButtons**, click **Run**. This adds
   the **Tools** tab with the buttons.
4. **File → Save As** → type **Excel Macro-Enabled Workbook (*.xlsm)** →
   save as `math/Proto_v2.xlsm`.
5. Commit `Proto_v2.xlsm` and delete `Proto_v2.xlsx`, so there's one
   workbook. The exporter uses the `.xlsm` whenever it exists.

If Excel shows "Microsoft has blocked macros", unblock the file (step 2 of
the first-time setup) or add the project folder under **File → Options →
Trust Center → Trust Center Settings → Trusted Locations**. The exporter
finds the math by its `Symbols` header, so the Tools and Sim Results tabs can
be in any order.

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
