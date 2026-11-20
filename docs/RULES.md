# Proto v2 — Game Rules

The rules the shared math engine implements. All numeric data lives in
`math/Proto_v2.xlsx`. This document describes how that data is used. All
amounts are in credits (cr).

## 1. Layout and wager

- 5 reels × 3 rows, 25 fixed paylines (`Lines` table; row 0 is the top).
- Fixed bet: **80 cr** per paid spin (`Setting: Bet`).
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
5. MB symbols pay nothing unless Hold & Spin triggers.
6. **Order of play** when both features trigger: Hold & Spin first, then free
   games.
7. **Progressive contribution:** every paid spin adds 0.7% of the bet
   (0.56 cr) to the Major meter and 0.2% of the bet (0.16 cr) to the Grand
   meter.

## 4. Free games

- 6 free games, played on `FG Reel1–5` (currently identical to the base reels)
  with the same pays and no multiplier.
- **Retrigger:** 3 or more SC1 adds 6 more games and pays the same 4 SC1 and
  5 SC1 credit awards.
- Hold & Spin can trigger during free games under the same rules. Free games
  resume when it finishes.
- Free games add nothing to the progressive meters, because no wager is made.

## 5. Hold & Spin

1. **Start:** the MBs that triggered the feature lock in place. Each locked MB
   gets one draw from the `MBPay` table, which can give a credit value, Mini,
   Minor or Major.
2. **Respins:** the counter starts at 3.
3. **Each respin:**
   - One unlocked position is picked uniformly at random. That position uses a
     *weighted* stop on the `HoldnSpin Reel`, using `HoldnSpin Reel Weights`.
   - Every other unlocked position uses an *unweighted*, uniform stop on the
     same strip.
   - Each position shows only the symbol at its chosen stop. An MB locks and
     gets an `MBPay` draw; any other symbol counts as a blank.
   - If at least one new MB locked, the counter resets to 3. Otherwise it goes
     down by 1.
4. **End:** the feature ends when the counter reaches 0 or all 15 positions
   are locked.
5. **Award:** the sum of every locked MB's credit value, plus the value of
   every Mini, Minor and Major won. The same jackpot can be won more than once.
   Add the Grand if all 15 positions are locked.

Probability that one position lands an MB on a respin (strip: 97 stops, 7 of
them MB):

| Position type | Probability |
|---|---|
| Unweighted | 7 / 97 ≈ 7.2% |
| Weighted | 7 / 90 007 ≈ 0.008% |

The weighted position is a deliberate pacing control: on each respin, one
open position almost never fills.

## 6. Jackpots

| Jackpot | Value | Won by |
|---|---|---|
| Mini | 1 000 cr, static | an `MBPay` draw |
| Minor | 2 500 cr, static | an `MBPay` draw |
| Major | 50 000 cr reset + 0.7% of each bet | an `MBPay` draw |
| Grand | 1 000 000 cr reset + 0.2% of each bet | 15 MBs on screen: on the triggering spin, or when Hold & Spin ends |

- **Paying a progressive:** a progressive pays its current meter value, and
  the meter then resets.
- **Grand on the triggering spin:** Hold & Spin then has no positions left to
  spin. It ends at once and pays its MB values plus the Grand.
- **Meter precision:** meters are kept in hundredths of a credit so that
  increments stay exact integers. Awards are paid in whole credits, rounded down.
