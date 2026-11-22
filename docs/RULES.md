# Proto v2 — Game Rules

The rules the shared math engine implements. All numeric data lives in
`math/Proto_v2.xlsx`. This document describes how that data is used. All
amounts are in credits (cr).

## 1. Layout and wager

- 5 reels × 3 rows, 25 fixed paylines (`Lines` table; row 0 is the top).
- Fixed bet: **80 cr** per paid spin (`Setting: Bet`).
- Denomination: **1¢** per credit (`Setting: Denomination Cents`), so the bet
  is $0.80. The engine works in credits. The game shows the jackpot meters,
  balance, bet, wins and banners in dollars; coin values stay in credits.
- There is no credits-per-line multiplier. Each winning line pays its `Pays`
  table value in credits, and scatter awards are also paid in credits.

## 2. Symbols

| Symbol | Role |
|---|---|
| M1–M4 | High pays |
| F1–F5 | Low pays |
| WW | Wild. Appears on reels 2–5 and substitutes for M1–M4 and F1–F5 only. No pay of its own. |
| SC1 | Scatter. Appears on reels 1–5, at most one visible per reel. |
| MB | Money ball. Carries a value or a jackpot. Drives Hold & Spin. |

## 3. Base game spin

0. **MB table draw:** at the start of each base game spin, one MB table is
   drawn from `MB Table Draw`: Low 85, Mid 10, High 5. Every MB value in that
   round comes from the drawn table, including MBs in any Hold & Spin
   triggered during its free games.
1. A stop is chosen uniformly on each base reel, and the reel shows that stop
   plus the next 2 positions, wrapping around the end of the strip.
2. **Line wins:** each line pays its highest left-to-right combination of
   3, 4 or 5 of a kind, with WW substituting. All line wins are added together.
3. **Scatter:** the number of SC1 symbols anywhere on screen.
   - 3 SC1: 6 free games, no credit award.
   - 4 SC1: 6 free games + 400 cr.
   - 5 SC1: 6 free games + 4000 cr.
4. **Hold & Spin trigger** (N = the number of MBs on screen):
   - N ≥ 6: triggers automatically.
   - 1 ≤ N ≤ 5: one draw on the `HoldnSpin MB Trigger` table for N
     (Yes weight : No weight).
   - N = 15: the Grand is awarded (see §6).
5. **MB values:** every MB that lands, in the base game or free games, gets
   its value at once: one draw from the round's MB table (a credit value,
   Mini, Minor or Major). The value is shown on the coin. MB symbols pay
   nothing unless Hold & Spin triggers.
6. **Order of play** when both features trigger: Hold & Spin first, then free
   games.
7. **Progressive contribution:** every paid spin adds 0.7% of the bet
   (0.56 cr) to the Major meter and 0.2% of the bet (0.16 cr) to the Grand
   meter.

## 4. Free games

- 6 free games, played on `FG Reel1–5`: the base reels with 4–6 extra MB
  per reel (in place of low symbols), so roughly 1 in 6 free-game bonuses
  reaches Hold & Spin
  with the same pays and no multiplier.
- **Retrigger:** 3 or more SC1 adds 6 more games and pays the same 4 SC1 and
  5 SC1 credit awards.
- Hold & Spin can trigger during free games under the same rules. Free games
  resume when it finishes.
- Free games add nothing to the progressive meters, because no wager is made.

## 5. Hold & Spin

1. **Start:** the MBs that triggered the feature lock in place, keeping the
   values they landed with. A jackpot shown on a triggering coin is paid at
   its current meter value when the coin locks.
2. **Respins:** the counter starts at 3.
3. **Each respin:**
   - One unlocked position is picked uniformly at random. That position uses a
     *weighted* stop on the `HoldnSpin Reel`, using `HoldnSpin Reel Weights`.
   - Every other unlocked position uses an *unweighted*, uniform stop on the
     same strip.
   - Each position shows only the symbol at its chosen stop. An MB locks and
     gets a draw from the round's MB table; any other symbol counts as a blank.
   - If at least one new MB locked, the counter resets to 3. Otherwise it goes
     down by 1.
4. **End:** the feature ends when the counter reaches 0 or all 15 positions
   are locked.
5. **Award:** the sum of every locked MB's credit value, plus the value of
   every Mini, Minor and Major won. The same jackpot can be won more than once.
   Add the Grand if all 15 positions are locked.

Probability that one position lands an MB on a respin (strip: 100 stops, 12
of them MB):

| Position type | Probability |
|---|---|
| Unweighted | 12 / 100 = 12% |
| Weighted | 12 / 88 012 ≈ 0.014% |

The weighted position is a deliberate pacing control: on each respin, one
open position almost never fills.

### MB tables

Low and Mid share the credit values 40 – 4 000. High uses a wider ladder,
160 – 8 000, so High coins vary instead of mostly showing 4 000.

| Credits | Low | Mid | High |
|---|---|---|---|
| 40 | 3 927 | 3 159 | – |
| 80 | 764 | 631 | – |
| 160 | 205 | 179 | 304 |
| 240 | 74 | 67 | 307 |
| 320 | 79 | 76 | 310 |
| 400 | 255 | 260 | 314 |
| 800 | 122 | 162 | 331 |
| 1 200 | 7 | 12 | 348 |
| 1 600 | 10 | 23 | 367 |
| 2 000 | – | – | 387 |
| 2 400 | – | – | 408 |
| 3 200 | – | – | 453 |
| 4 000 | 90 | 964 | 503 |
| 6 000 | – | – | 653 |
| 8 000 | – | – | 848 |
| Mini / Minor / Major | 26 / 8 / 1 | 26 / 8 / 1 | 26 / 8 / 1 |
| **Average credit value** | **159 cr** | **793 cr (5.0×)** | **3169 cr (20.0×)** |
| **Draw weight** | **85** | **10** | **5** |

Every table's credit weights total 5 533, and each has Mini 26, Minor 8 and
Major 1. The jackpot odds per MB are therefore the same in all three: the
Major is 1 in 5 568 per MB, about 1 in 54 000 rounds overall.

## 6. Jackpots

| Jackpot | Value | Won by |
|---|---|---|
| Mini | 1 000 cr, static | an MB table draw |
| Minor | 2 500 cr, static | an MB table draw |
| Major | 50 000 cr reset + 0.7% of each bet | an MB table draw |
| Grand | 1 000 000 cr reset + 0.2% of each bet | 15 MBs on screen: on the triggering spin, or when Hold & Spin ends |

- **Paying a progressive:** a progressive pays its current meter value, and
  the meter then resets.
- **Grand on the triggering spin:** Hold & Spin then has no positions left to
  spin. It ends at once and pays its MB values plus the Grand.
- **Meter precision:** meters are kept in hundredths of a credit so that
  increments stay exact integers. Awards are paid in whole credits, rounded down.

## 7. Math summary

Measured over 100 million simulated rounds (two 50M-round seeds), at a bet of
80 cr.

| | Target | Result |
|---|---|---|
| Total RTP | 90% | 89.7% ± 0.3% |
| Base game (lines + scatter pays) | ≈ 35% | 35.7% (exact) |
| Free games trigger | ≈ 1 in 120 | 1 in 121 (exact) |
| Hold & Spin trigger (base game) | ≈ 1 in 120 | 1 in 120 (exact) |
| Free-game bonuses that reach Hold & Spin | ≈ 1 in 6 | 1 in 6.0 |
| MB chance per unweighted Hold & Spin position | ≈ 12% | 12% |
| Major jackpot | ≈ 1 in 50 000 rounds | 1 in 54 000 |

### Where the return comes from

| Source | Return |
|---|---|
| Base game lines + scatter | 35.7% |
| Free games lines + scatter | 1.7% |
| Hold & Spin credits (base / in FG) | 41.7% / 6.9% |
| Mini / Minor / Major / Grand | 0.6% / 0.5% / 1.9% / 0.8% |

- Average Hold & Spin award by table: Low 25×, Mid 111×, High 432× bet.
- Standard deviation per round is about 17× bet.
- The Grand hit 50 times in 100M rounds (about 1 in 2 million), so its share
  is only approximate.
