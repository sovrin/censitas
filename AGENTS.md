# Agent notes for censitas

censitas is a module of [nexitas](../nexitas): a Nuxt layer that nexitas extends. Follow
[nexitas' agent notes](../nexitas/AGENTS.md) for everything a module shares: code, data access,
project scoping, what the core gives a module, and the UI. What follows is censitas' own.

## Code

- censitas registers itself in `server/core/module.ts`, its schema steps included. Each site counts
  for one nexitas project and takes its origins from it; censitas keeps only the site's events (and
  its id, which the tracker names). It is started and set up on its own first page, Usage
  (`app/pages/p/[project]/sites/index.vue`): the tracker and the events in its Setup.
- Every rule about input lives once, in `shared/contracts.ts` (zod), and is checked at runtime on
  the server: a site's settings and each beacon. The dashboard's forms use the same schemas.
- Privacy of counts: nothing that tells visitors apart is stored or logged: no IP address, user
  agent, time of day, page address, referrer or identifier, and no new column that could hold one.
  The IP address and user agent are read in memory for the bot check and the rate limit, and
  dropped. Only names and values from a site's settings reach the counters.
- The tracker (`widget/`) runs in other people's pages: it uses no cookie or storage API, reads
  nothing from the browser, and makes no identifier. `tests/unit/track.test.ts` holds it to that.
- The beacon route is public through `publicRoutes` in `server/core/module.ts`. `/v1/*` is public
  and versioned: sites already out there load the tracker and send its beacons, so it only grows
  (new fields optional, nothing renamed or removed).
- The dashboard is live: whatever changes what it shows calls `announceChange()` (settings) or
  `announceBeacon()` (counts, paced to once per 3 s, in `server/utils/censitas.ts`), and every view
  that shows data passes its refresh to `useLive`.

## UI

- `app/assets/app.css` holds only what censitas alone draws: the day charts, the headline figures
  and the share bars.
- Daily counts are a column chart per event (page views larger); prop values are tables with a
  share bar; figures compare with the period before as a `.delta`.
- Lint changed Vue files:
  `node ../aequitas/dist/aequitas-check.mjs --css app/assets/app.css --css ../nexitas/app/assets/nexitas.css <files>`.

## Checks

`pnpm check`, `pnpm lint` and `pnpm format:check` must stay green here, and `pnpm check` and
`pnpm build` in nexitas with this checkout in its `.modules/`.

## Commits and releases

As in nexitas. Mark a change that breaks the public `/v1` API or the tracker's embed with `!`
(`feat(api)!: …`), since sites already out there depend on them.
