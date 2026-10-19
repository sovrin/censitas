# Agent notes for censitas

Conventions for working on censitas, in code and in the interface.

## Code

- Keep comprehension debt low: explicit control flow, small modules, framework conventions, no
  speculative abstractions. Comments say why, not what.
- Every rule about input lives once, in `shared/contracts.ts` (zod), and is checked at runtime on
  the server: the sites file and each beacon.
- Data access is plain SQL in `server/core/*.ts`: functions that take the database first, no ORM.
  Schema changes are a new `PRAGMA user_version` step in `server/core/database.ts`; never edit a
  released step.
- Privacy is the product. Nothing that tells visitors apart is stored or logged: no IP address,
  user agent, time of day, page address, referrer or identifier, and no new column that could hold
  one. The IP address and user agent are read in memory for the bot check and the rate limit, and
  dropped. Only names and values from the sites file reach the database.
- The tracker (`widget/`) runs in other people's pages: it uses no cookie or storage API, reads
  nothing from the browser, and makes no identifier. `tests/unit/track.test.ts` holds it to that.
- Everything is the owner's dashboard behind basic auth (`server/middleware/security.ts`), except
  the public paths listed there. `/v1/*` is public and versioned: sites already out there load the
  tracker and send its beacons, so it only grows (new fields optional, nothing renamed or removed).

## UI

- Built only from aequitas: semantic HTML plus its classes, `data-*` variants and ARIA state.
  `app/assets/app.css` holds only what aequitas lacks, with tokens only.
- The look: one centred small column hanging from the top, compact density, square corners, no
  cards, panels or sidebar. Colour only reports state, always next to a word. Site ids, origins,
  event names, props, values and days are mono. Daily counts are a column chart per event, each with
  its table under it; breakdowns are tables. Text actions first, at most one primary button per
  view.
- Lint changed Vue files: `node ../aequitas/dist/aequitas-check.mjs --css app/assets/app.css <files>`.

## Checks

`pnpm check`, `pnpm lint`, `pnpm format:check` and `pnpm build` must stay green.

## Commits and releases

Commit messages are [conventional](https://www.conventionalcommits.org):
`feat(dashboard): …`, `fix: …`, `docs(readme): …`. Give a scope or leave the parentheses out; never
write `feat(): …`. release-please can't parse an empty scope and silently drops the commit from
the next version and the changelog. Before 1.0, `feat` and `fix` bump the patch version and a
change marked `!` the minor. Mark a change that breaks the public `/v1` API or the tracker's
embed with `!` (`feat(api)!: …`), since sites already out there depend on them. Don't edit the
version in `package.json` or `CHANGELOG.md` by hand; the release PR does that.
