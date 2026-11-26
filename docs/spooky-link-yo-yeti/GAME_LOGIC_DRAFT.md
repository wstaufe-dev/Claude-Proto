# v3 Cash Collect — draft game logic

Status: **draft for discussion**. Nothing here is final. Working names are
placeholders. Numbers in *italics* are starting suggestions taken from the
research (`RESEARCH.md`); the math workbook will replace them.

## 1. Base game

- 5 × 3 reels, line pays, wild, as in v2 (the details wait for the math).
- Symbols new to v3:
  - **COL** (collector): reel 1 only.
  - **GEM-A / GEM-B / GEM-C**: one colour per pot, reels 2–5. Each gem
    carries a prize (credits or a small jackpot), drawn when it lands.
  - **COIN**: carries a credit prize. Pays only in the bonus.
- **Three pots** sit above the reels, one per gem colour. A landing gem of a
  colour flies into its pot.

## 2. Triggering Cash Collect

Proposed rule (to confirm, see Q1–Q2):

1. **COL on reel 1 + at least one gem:** Cash Collect triggers. Every pot
   whose colour landed on that spin **pops**, so its modifier is on.
2. **Gems without COL:** each pot that received a gem has a chance to pop
   anyway (one weighted draw per pot). If any pot pops, Cash Collect
   triggers with those modifiers.
3. Any of the 7 combinations is possible: A, B, C, AB, AC, BC, ABC.
4. The gems from the triggering spin become **diamonds** on the bonus grid,
   in the same reel positions, keeping their prizes. Coins from the trigger
   spin carry over too (to confirm, Q4).

## 3. Cash Collect core (always on)

1. **Grid:** 5 columns × 5 rows (8 rows with the grid modifier, §4).
2. **Collector block** starts at 2 × 2 at a fixed or random position
   (Q5).
3. **Spins:** the counter starts at *5*.
4. **Each spin:**
   1. Every empty cell outside the collector draws: blank, coin or diamond.
      Coins and diamonds draw a prize at once.
   2. The collector moves to a new position on the grid (Q6: random, or
      chosen to cover the most prizes).
   3. Every coin and diamond under the collector is **collected**: its prize
      is added to the bonus total and the cell empties.
   4. Each collected diamond adds 1 to the **diamond count**. If the count
      reaches a growth threshold, the collector grows and spins are added:

      | Diamonds (total) | Collector | Spins added |
      |---|---|---|
      | *5* | 3 × 3 | *+3* |
      | *9* | 4 × 4 | *+2* |
      | *12* | 5 × 5 | *+1* |
      | further (8-row grid only) | 5 × 6, 5 × 7, 5 × 8 (Q7) | *+1* each |

   5. The counter goes down by 1.
5. **End:** when the counter reaches 0, the bonus total is paid.
6. Spins do **not** reset when something lands. The counter only goes up
   through awards (Q3).

## 4. The three pot modifiers

| Pot | Working name | Effect while on |
|---|---|---|
| A | **More Spins** | Coins and diamonds can land with a +1, +2 or +3 spin tag. When collected, the tag adds that many spins. |
| B | **More Symbols** | A cell can land holding two prizes (two coins or two diamonds). A double diamond counts as 2 toward growth. |
| C | **More Rows** *or* the **Yeti Throw** (Q8) | More Rows: the grid is 5 × 8 instead of 5 × 5, and the collector can grow to fill it. Yeti Throw: at random, before a spin's collect step, a character throws 1–N snowballs into empty cells. Each snowball becomes a credit prize, a jackpot or a +1 spin prize. |

All active modifiers apply together. With all three on, the bonus is at its
richest; the math will set how often each combination occurs.

## 5. Event order per spin (for the engine)

To match v2, the engine emits events and the web layer only animates them.

1. `cc-spin-start` (spin number, spins left)
2. `cc-yeti-throw` (only if that modifier is on and it fires): the cells and
   prizes
3. `cc-land`: each new coin or diamond with its prize, tags and doubles
4. `cc-collector-move`: from and to position, size
5. `cc-collect`: each collected cell, prize, spin tag
6. `cc-grow` (if a threshold is reached): new size, spins added
7. `cc-spin-end` (bonus total so far, spins left)
8. `cc-end`: the total paid

## 6. Open questions for the designer

- **Q1.** Pot meter: does a pot pop only when its gem lands with COL, or does
  each pot also fill like a meter over base spins and pop when full
  (persistent state between spins)?
- **Q2.** Is COL required, or can the bonus trigger from gems alone?
- **Q3.** Fixed counter (Mo Mummy style) or reset to N whenever a prize lands
  (Hold & Spin style)? The draft says fixed.
- **Q4.** Do trigger-spin coins carry into the bonus, or only gems?
- **Q5.** Where does the 2 × 2 collector start?
- **Q6.** How does the collector move: random position, random step to a
  neighbour, a fixed sweep, or a smart choice? This shapes the feel the most.
- **Q7.** On the 8-row grid, what are the growth steps after 5 × 5?
- **Q8.** The third pot: More Rows (as in Mo Mo Mo Mummy and Go Ghost), or
  the Yeti Throw? Or should the Yeti Throw be a fourth, always-possible event?
  The research could not settle how the Yo Yeti title does it.
- **Q9.** Which jackpots exist, which can appear on coins and diamonds, and is
  there a pick feature as in Mo Mummy?
- **Q10.** Free games: in scope for v3, or the Cash Collect bonus only?
- **Q11.** Theme and names: our own character and pot names, so the prototype
  doesn't reuse Aristocrat's.
