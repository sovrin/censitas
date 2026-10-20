# Agent notes for censitas

Conventions for working on censitas, in code and in the interface.

## Code

- censitas is a module of [nexitas](../nexitas): a plain Nuxt layer that nexitas extends. The
  owner's sign-in, the `/api` guard, live updates, the database, projects and the page shell are
  there, and plug-in points are its interfaces (`shared/modules.ts`). censitas registers itself in
  `server/core/module.ts`. What every app needs belongs in nexitas; what only censitas needs, here.
- Each site counts for one nexitas project and takes its origins from it; censitas keeps only the
  site's events (and its id, which the tracker names). Its panel on a project's page is
  `app/components/global/CensitasProject.vue`.
- Import by relative path (or `#nexitas/...`): `~` and `#shared` resolve against nexitas, the app
  around this layer. Nothing app-wide lives here: no name, logo, favicon or sign-in lines.
- Keep comprehension debt low: explicit control flow, small modules, framework conventions, no
  speculative abstractions. Comments say why, not what.
- Every rule about input lives once, in `shared/contracts.ts` (zod), and is checked at runtime on
  the server: a site's settings and each beacon. The dashboard's forms use the same schemas.
- Data access is plain SQL in `server/core/*.ts`: functions that take the database first, no ORM.
  Schema changes are a new step in `migrations` in `server/core/module.ts`; never edit a released
  step.
- Privacy is the product. Nothing that tells visitors apart is stored or logged: no IP address,
  user agent, time of day, page address, referrer or identifier, and no new column that could hold
  one. The IP address and user agent are read in memory for the bot check and the rate limit, and
  dropped. Only names and values from a site's settings reach the counters.
- The tracker (`widget/`) runs in other people's pages: it uses no cookie or storage API, reads
  nothing from the browser, and makes no identifier. `tests/unit/track.test.ts` holds it to that.
- `/api/*` is the dashboard's (nexitas' security middleware): the owner's session, and for writes
  the exact `CENSITAS_ORIGIN`; only the sign-in routes and `/api/health` are open. The beacon route
  is public through `publicRoutes` in `server/core/module.ts`. `/v1/*` is public and versioned: sites already out there load the tracker and send its
  beacons, so it only grows (new fields optional, nothing renamed or removed).

- The dashboard is live: whatever changes what it shows calls `announceChange()` (settings) or
  `announceBeacon()` (counts, paced to once per 3 s, in `server/utils/censitas.ts`), and every view
  that shows data passes its refresh to `useLive`.

## UI

- Built only from aequitas: semantic HTML plus its classes, `data-*` variants and ARIA state.
  `app/assets/app.css` holds only what aequitas and nexitas' shell lack, with tokens only.
- The look: nexitas' shell (navbar, one small column, statusbar); inside a page, compact density,
  square corners, no cards, panels or sidebar. Colour only reports state, always next to a word.
  Site ids, origins, event names, props, values and days are mono. Daily counts are a column chart
  per event (page views larger), each with its table under it; prop values are tables with a share
  bar; figures compare with the period before as a .delta. Text actions first, at most one primary
  button per view.
- Lint changed Vue files: `node ../aequitas/dist/aequitas-check.mjs --css app/assets/app.css --css ../nexitas/app/assets/nexitas.css <files>`.

## Checks

`pnpm check`, `pnpm lint` and `pnpm format:check` must stay green here, and `pnpm check` and
`pnpm build` in nexitas with this checkout in its `.modules/`.

## Commits and releases

Commit messages are [conventional](https://www.conventionalcommits.org):
`feat(dashboard): …`, `fix: …`, `docs(readme): …`. Give a scope or leave the parentheses out; never
write `feat(): …`. release-please can't parse an empty scope and silently drops the commit from
the next version and the changelog. Before 1.0, `feat` and `fix` bump the patch version and a
change marked `!` the minor. Mark a change that breaks the public `/v1` API or the tracker's
embed with `!` (`feat(api)!: …`), since sites already out there depend on them. Don't edit the
version in `package.json` or `CHANGELOG.md` by hand; the release PR does that.
