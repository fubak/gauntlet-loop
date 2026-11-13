# Gauntlet Loop

Public multiplayer HTML5 Canvas highway shooter packed as one HTML file for the Tesla in-car browser and desktop dev. Vanilla JavaScript, no client bundler. Each player's real-world location stays private to their session.

## Pack the car file

```bash
npm run pack
# same as ./scripts/pack.sh
```

Output: `dist/index.html` (inlined modules from `src/`, no tests, fixtures, or `worker/`).

## Local Worker (dev only)

```bash
npm run pack
npm run dev:worker   # http://127.0.0.1:8787
```

`npm test` runs `src/parse-intent.test.js` and `src/room-allowlist.test.js`.

Optional: `npm run predev:worker` copies map fixtures into `dist/fixtures/` for desktop query flags.

## Deploy and preview note

This repo pins **Wrangler ^4.135.0** (project-local `npm install`). Wrangler 4 `wrangler preview` publishes a **Workers Preview** URL (public HTTPS, not production). Wrangler 3 `preview` was only a local request tester.

Production deploy is **intentionally not part of day-to-day dev**. Do not run `wrangler deploy` until an explicit go. Maintainers publish previews with `npm run pack` then `npx wrangler preview` after bindings in `wrangler.toml` (including the `[previews]` block) are satisfied. Preview `WRITER_INDEX` uses KV id `4509d6eed79a4231a4b4f6815ab019cd` (`gauntlet-loop-writer-index-preview`); production KV stays binding-only until deploy. PlayThing uses that preview URL for the parked Tesla playtest. That is separate from claiming the in-car browser works until Phase 0 and a real parked session on the car are recorded.

## Desktop probes

- Feature table: `?probe=1`
- Map fixture: `?locationFixture=stale` (requires fixtures in `dist/fixtures/`)
- Cockpit default off; parked toggle or `?cockpit=1`
