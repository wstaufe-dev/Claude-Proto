# v3 Cash Collect — draft game logic

Status: **draft for discussion**, revised after round 2 of the research.
Nothing here is final. Working names are placeholders. Numbers in *italics*
are starting suggestions from the research (`RESEARCH.md`); the math
workbook will replace them.

## 1. Base game

- 5 × 3 reels, line pays, wild, as in v2 (the details wait for the math).
- Symbols new to v3:
  - **COL** (collector character): reel 1 only.
  - **GEM-S / GEM-D / GEM-Y**: one colour per pot (Spins, Doubles, Yeti
    throw), reels 2–5. Each gem carries a prize (credits or a jackpot),
    drawn when it lands.
- **Three pots** sit above the reels. A landing gem flies into the pot of its
  colour.
- Other features in the reference game (free games, 15-symbol jackpot pick)
  are out of scope unless the designer adds them (Q10).

## 2. Triggering Cash Collect

1. **COL on reel 1 + at least one gem:** Cash Collect triggers. Every pot
   whose colour landed on that spin **pops**, so its modifier is on.
2. **Gems without COL:** each pot that received a gem has a chance to pop
   anyway (one weighted draw per pot). If any pot pops, Cash Collect
   triggers with those modifiers.
3. Any of the 7 combinations is possible: S, D, Y, SD, SY, DY, SDY.
4. Pots hold no state between spins; their glow is presentation only
   (Q1 asks whether you want a real meter instead).
5. The gems from the triggering spin become **diamonds** on the bonus grid,
   keeping their prizes, and count as collected at the start.

## 3. Cash Collect core (always on)

1. **Grid:** 5 columns × 5 rows.
2. **Collector zone** starts at 2 × 2 (Q5: where).
3. **Spins:** the counter starts at *5*.
4. **Each spin:**
   1. Every empty cell draws: blank, coin or diamond. Coins and diamonds
      draw a prize at once.
   2. **Diamonds anywhere** on the grid are collected: the character walks
      to each, takes it, and throws it onto the **power-up bar**.
   3. **Coins inside the zone** are collected. Coins outside the zone are
      lost (Q6: do they stay on the grid for later spins?).
   4. If the power-up bar reaches a threshold, the zone grows and spins are
      added:

      | Diamonds (total) | Zone | Spins added |
      |---|---|---|
      | *5* | 3 × 3 | *+3* |
      | *9* | 4 × 4 | *+2* |
      | *12* | 5 × 5 | *+1* |

   5. The counter goes down by 1.
5. **End:** when the counter reaches 0, the bonus total is paid.
6. Spins do **not** reset when something lands. The counter only goes up
   through power-ups and modifiers.

## 4. The three pot modifiers

| Pot | Working name | Effect while on |
|---|---|---|
| S | **More Spins** | Diamonds (and coins?, Q9) can land with a *+1* spin tag. Collecting a tagged symbol adds that many spins. |
| D | **Doubles** | A cell can land holding two prizes (two coins or two diamonds). A double diamond counts as 2 on the power-up bar. |
| Y | **Snow Throw** | At random, after symbols land, the character appears and throws *1–N* snowballs onto empty cells. Each becomes a credit prize, a jackpot or a +1 spin prize. |

All active modifiers apply together. The math will set how often each
combination occurs.

## 5. Event order per spin (for the engine)

As in v2, the engine emits events and the web layer only animates them.

1. `cc-spin-start` (spin number, spins left)
2. `cc-land`: each new coin or diamond, with prize, spin tag and double flag
3. `cc-snow-throw` (only if pot Y is on and it fires): cells and what each
   snowball became
4. `cc-collect-diamond`: each diamond, its prize, the path the character
   walks, and power-up bar progress
5. `cc-collect-coin`: each coin inside the zone, its prize
6. `cc-spins-added` (spin tags, snowball +1s)
7. `cc-grow` (if a threshold is reached): new zone size and position,
   spins added
8. `cc-spin-end` (bonus total so far, spins left)
9. `cc-end`: the total paid

## 6. Open questions for the designer

Settled by round 2: ~~Q8 the third pot~~ (it is the Yeti-style throw; no
extra-rows pot), ~~Q3 counter resets~~ (fixed counter).

- **Q1.** Pots: no state between spins (as the reference seems to work), or a
  real meter that fills over base spins?
- **Q2.** Is COL required, or can the bonus trigger from gems alone (random
  "metamorphic" pop)? The draft allows both.
- **Q4.** Do trigger-spin coins carry into the bonus, or only gems?
- **Q5.** Where does the 2 × 2 zone start, and where does it sit after it
  grows (fixed corner, centre, or follows the character)?
- **Q6.** Coins that land outside the zone: lost at once, or left on the grid
  so a growing zone can pick them up later?
- **Q7.** Snow Throw: how many snowballs, and must snowball prizes be in the
  zone to count, or are they collected like diamonds?
- **Q9.** More Spins: tags on diamonds only, or coins too? +1 only, or
  +2 and +3 as well?
- **Q10.** Free games and the jackpot pick: in scope for v3, or the Cash
  Collect bonus only?
- **Q11.** Which jackpots exist and which can appear on coins, diamonds and
  snowballs?
- **Q12.** Theme and names: our own character and pot names, so the
  prototype doesn't reuse Aristocrat's.
