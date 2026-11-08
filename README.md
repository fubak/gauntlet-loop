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

## Deploy note

Production deploy is **intentionally not part of day-to-day dev**. Do not ship until an explicit go. When ready, publish the Worker and static assets (packed `dist/`) to your Cloudflare account with `wrangler deploy` from a maintainer machine. This repo does not auto-deploy.

The **Tesla parked playtest** path is a preview URL (for example via PlayThing) over public HTTPS on the same origin as `/v1/*`. That preview is separate from claiming the in-car browser works until Phase 0 and a real parked session on the car are recorded.

## Desktop probes

- Feature table: `?probe=1`
- Map fixture: `?locationFixture=stale` (requires fixtures in `dist/fixtures/`)
- Cockpit default off; parked toggle or `?cockpit=1`
