# Project notes for Claude

## Keep the hosted game up to date

The playable game is published as a private artifact:
https://claude.ai/artifact/84kUEjHb6Vzo3ZVvR7GWBN

It is also public on GitHub Pages at https://wstaufe-dev.github.io/Claude-Proto/,
deployed automatically by `.github/workflows/pages.yml` on every push.

After any change that affects the game (math workbook, engine, presentation, art):

1. `npm run export-config` if `math/Proto_v2.xlsx` changed
2. `npm test` and `npm run typecheck`
3. `npm run build:artifact` (writes `dist-artifact/golden-fortune.html`)
4. Republish that file to the URL above (Artifact publish with `url` set to it;
   read it first if this conversation hasn't published or read it yet)
5. Commit and push

Do this without being asked, and tell the user it was republished.

## Working rules

- Math data lives in `math/Proto_v2.xlsx`; rules in `docs/RULES.md`. Keep both in sync.
- All award logic belongs in `src/engine/`; `web/` only animates engine events.
