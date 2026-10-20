# censitas

How your sites are used, counted, not who uses them. Load one script, send a few named events,
read daily counts.

**censitas is a module for [nexitas](https://github.com/sovrin/nexitas), not an app of its own.** It ships inside
nexitas, which builds it in from its `modules.json`, and an install's owner
switches it on as Usage. An install that leaves it off counts nothing at all. To use it, install
nexitas. nexitas brings the sign-in, the page shell, the database and the projects (each site's
name and origins); censitas adds:

- a tracker that a project's pages load by URL, and the public endpoint its beacons go to;
- the usage pages: every site's daily counts and the share of each prop value;
- a Usage panel on each project's page: start counting, today's figure, the tracker snippet.

It stores only counters (site, UTC day, event, prop value, count) and nothing that could tell one
visitor from another.

## How it fits together

```
site (e.g. sonotas) ── GET  /v1/track.js?site=<id>  → the tracker; it counts a page view on import
                     ── POST /v1/e                   → one event, counted if its site allows it
owner               ── /projects/<id>                a project's usage panel and tracker (nexitas)
(signed in)         ── /sites                        usage across sites, daily counts, breakdowns
                     ── GET  /api/events             → live: "something changed", every 3 s at most
```

## What is counted

Each beacon adds one to its event's counter for the day, and one to each prop value it carries.
A `load` event with `{ source: 'demo', format: 'gp5' }` raises three counters for today: `load`,
`load · source = demo` and `load · format = gp5`. The dashboard shows each event per day and the
share of each prop value.

That is all that is kept. No row holds a time of day, a page address, a referrer, an IP address, a
user agent or any identifier, so no two counts can be joined into one person's visit. Props are
counted one by one, so they can't be combined either: censitas knows how many exports were 1080p
and how many were dark, not how many were both.

Only names and values listed in the site's settings are counted. A forged beacon can at most raise a
counter that exists already; it cannot put new text in the database.

## Why no consent banner

- **Nothing on the device.** track.js sets no cookie and uses no localStorage, sessionStorage,
  IndexedDB or cache, and reads nothing from the browser beyond what every request carries. It
  makes no identifier and no fingerprint. Nothing is stored on or read from the visitor's device,
  so §25 TDDDG (consent for device storage and access) does not apply.
- **No personal data kept.** The IP address and user agent reach the server with every request,
  as they do for any page. censitas uses them in memory only (the user agent to drop bots, the
  address to rate-limit for one minute) and then drops them; neither is written to the database
  or the log. What is stored is aggregate counts, which relate to no one. That short use to keep
  the service working rests on legitimate interest (Art. 6(1)(f) GDPR), not on consent.
- **No third party.** You run censitas yourself; no one else sees the requests.

This is the reasoning behind the design, not legal advice. Mention censitas in your privacy notice
all the same, for example:

> We count how this site is used with censitas, on our own server: each page view and a few
> actions (such as starting an export) raise anonymous daily counters; no cookies, nothing stored
> on your device, no identifiers, and your IP address is used only briefly in memory to stop abuse
> and never stored.

> Wir zählen mit censitas auf unserem eigenen Server, wie diese Seite genutzt wird: Jeder
> Seitenaufruf und einige Aktionen (etwa ein gestarteter Export) erhöhen anonyme Tageszähler; keine
> Cookies, nichts auf Ihrem Gerät gespeichert, keine Kennungen, und Ihre IP-Adresse wird nur kurz
> im Arbeitsspeicher zur Missbrauchsabwehr genutzt und nie gespeichert.

## Include it in a site

No package to install: import the tracker by URL, naming the site. Load it in the background, so
the page never waits on it, and let `track()` do nothing until it has loaded:

```js
// Counting is optional: until track.js has loaded, or if it never does, track() does nothing.
let track = () => {}
import('https://nexitas.example.com/v1/track.js?site=sonotas').then(
  (module) => (track = module.track),
  () => {},
)

// later, anywhere
track('export-start', { resolution: '1080p', theme: 'dark' })
```

Importing it counts one `pageview`. Each `track(event, props)` sends one beacon
(`navigator.sendBeacon`, text/plain, so there's no CORS preflight and it survives the tab closing).
Prop values are strings. A beacon its site doesn't allow is refused with a 400 or 403 that
only your network panel shows; check there when a counter stays at 0. Bucket anything continuous
before you send it: `duration: '1-3min'`, never `duration: '127'`.

In a Nuxt or Vite app, the URL is external, so mark the import `/* @vite-ignore */`.

## Sites

A site is a nexitas project that counts: Count usage on the project's page starts it. Each has:

- **an id**, the project's, which the tracker is imported with (`?site=sonotas`) and which never
  changes;
- **origins**, the project's, set on its page and shared by every module, matched exactly against
  each beacon's `Origin`;
- **events**: every event the site sends, each with the props it may carry and every value each
  prop may take. A new site starts with `pageview`, which the tracker sends on import. Names are
  lowercase with dashes, props letters and digits, values up to 64 of letters, digits and
  `. : + - _`.

A beacon a site sends that its settings don't list is refused and lost, so censitas counts refusals
per site and day by reason (an origin, event, prop or value not listed), never what was sent. The
site page shows how many next to Settings, with the details at its end: update the settings when a
release starts sending something new, then Clear them; only refusals after that show again. A change
applies from the next beacon on. The site's settings page shows the snippet to put in it.
Delete counts (on the settings page) starts a site over from zero, after testing for example, and
keeps its settings and tracker; deleting the site deletes its counts with it.

**Import and export** (under Usage) move settings, never counts, as one JSON file. A file's origins
become its project's, for every module; a site whose project does not exist yet gets one:

```json
{
  "censitas": 1,
  "sites": [
    { "id": "sonotas", "origins": ["https://sonotas.example.com"], "events": { "pageview": {} } }
  ]
}
```

Import shows what it adds and which sites' settings it replaces before it changes anything; the
replaced sites keep their counts. `examples/sonotas.json` is the full set for sonotas: opening a
file by format, exports by their settings (aspect, resolution, fps, quality, fast export, layout,
view, staves, theme, song length), how long a finished export took, failures, cancels, downloads
and copied links. Send each value as the file lists it (`fps: '30'`, `layout: 'line'`), and bucket
anything continuous, like the song length, before sending it.

## Abuse

Beacons need a configured site, a matching `Origin` and listed names and values, and must state
their
length and stay under 4 kB. Requests without a user agent or with a known bot's are answered 204
and not counted. Each sender (an IPv4 address or an IPv6 /64) may send 60 events a minute; the
table of senders lives in memory and is dropped every minute. None of this can stop someone
sending allowed beacons by hand, and nothing can; it keeps them to raising existing counters, at a
rate.

## Develop

censitas has no app, build or image of its own: it runs inside nexitas. Check out nexitas,
aequitas and censitas next to each other, build aequitas once
(`cd ../aequitas && pnpm install && pnpm build`), and put this checkout into nexitas' modules:

```sh
pnpm install
ln -s ../../censitas ../nexitas/.modules/censitas
cd ../nexitas && pnpm modules && pnpm install && pnpm dev
```

`pnpm modules` fetches the other modules nexitas lists and leaves the symlink to this checkout as
it is. Open http://localhost:3000, create the owner with the key in nexitas' `.data/bootstrap-token`,
and switch Usage on, at setup or under Modules. The typecheck of the pages and server runs in
nexitas (`pnpm check` there); here `pnpm check` covers the tracker and the unit tests.

## In an install

censitas runs wherever nexitas does: see nexitas' README for Compose, the proxy and the settings.
Keep the proxy from logging requests to `/v1/e`, or it stores the addresses censitas drops. Sites
and counters hold no personal data, so they are kept until you delete them. Off (under Modules),
its pages and `/v1/e` answer 404 and nothing is counted; its counts are kept.

## Checks

```sh
pnpm check         # the tracker's typecheck and the unit tests
pnpm lint
pnpm format:check
node ../aequitas/dist/aequitas-check.mjs --css app/assets/app.css --css ../nexitas/app/assets/nexitas.css app/**/*.vue
```
