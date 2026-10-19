# censitas

How your sites are used, counted, not who uses them. Load one script, send a few named events,
read daily counts.

censitas is one small service: a tracker that sites load by URL, a public endpoint its beacons go
to, and a private dashboard for the owner. It stores only counters (site, UTC day, event, prop
value, count) and nothing that could tell one visitor from another. It is Nuxt, SQLite through
`node:sqlite` and aequitas for every pixel, behind your own reverse proxy.

## How it fits together

```
site (e.g. sonotas) ── GET  /v1/track.js?site=<id>  → the tracker; it counts a page view on import
                     ── POST /v1/e                   → one event, counted if its site allows it
owner               ── /                             sites, daily counts, breakdowns, settings
(signed in)
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
import('https://censitas.example.com/v1/track.js?site=sonotas').then(
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

Sites are configured in the dashboard (Sites → Add a site), each with:

- **an id**, which the tracker is imported with (`?site=sonotas`) and which never changes;
- **origins**, the sites that may send, matched exactly against each beacon's `Origin`;
- **events**: every event the site sends, each with the props it may carry and every value each
  prop may take. A new site starts with `pageview`, which the tracker sends on import. Names are
  lowercase with dashes, props letters and digits, values up to 40 of letters, digits and
  `. : + - _`.

A beacon a site sends that its settings don't list is refused and lost, so censitas counts refusals
per site and day by reason (an origin, event, prop or value not listed), never what was sent. The
site page shows how many next to Settings, with the details at its end: update the settings when a
release starts sending something new, then Clear them; only refusals after that show again. A change
applies from the next beacon on. The site's settings page shows the snippet to put in it.
Delete counts (on the settings page) starts a site over from zero, after testing for example, and
keeps its settings and tracker; deleting the site deletes its counts with it.

**Import and export** (under the sites list) move settings, never counts, as one JSON file:

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

Node 24+ and pnpm 11. aequitas is not published yet: check it out next to this repository and
build it once (`cd ../aequitas && pnpm install && pnpm build`), or point `AEQUITAS_DIST` at
another built `dist/`.

```sh
pnpm install
pnpm dev
```

Open http://localhost:3100. On first run the launcher writes a random installation key to
`.data/bootstrap-token`; use it to create the owner account. `PORT` moves the dev server. Forgot
the password? `pnpm owner:reset --confirm` (with `CENSITAS_DATA_DIR` pointing at the data) removes
the owner and every session, keeps sites and counts, and lets you set up again with the key.

## Run with Docker Compose

Copy `.env.example` to `.env`, set `CENSITAS_BOOTSTRAP_TOKEN` (`openssl rand -hex 32`) and the
public address, `CENSITAS_ORIGIN=https://censitas.example.com`: the dashboard only accepts changes
sent from there. Then:

```sh
docker compose up -d --build
```

The web service listens on `127.0.0.1:3100` (`CENSITAS_BIND`). TLS and the public address belong
to your reverse proxy: put it, or the network it shares, in an untracked `compose.override.yaml`.
Open the address and create the owner account with the installation key; only one owner exists,
and its session cookie is `Secure` on HTTPS. The proxy must append the caller's address to
`X-Forwarded-For`; the rate limit counts senders by its last entry. Keep it from logging requests
to `/v1/e` too, or it stores the addresses censitas drops. With Caddy, which logs nothing unless
told to:

```
censitas.example.com {
	reverse_proxy 127.0.0.1:3100
	header Strict-Transport-Security "max-age=31536000"
}
```

Put nothing else (a CDN) in front of the proxy without changing how the sender is read. The image
runs as an unprivileged user on Alpine with only the node binary.

Sites and counters live in the `censitas-data` volume (`censitas.sqlite`); back it up and never
`docker compose down -v`. They hold no personal data, so they are kept until you delete them.

## Checks

```sh
pnpm check         # typecheck (app, server, tracker) and unit tests
pnpm lint
pnpm format:check
pnpm build
node ../aequitas/dist/aequitas-check.mjs --css app/assets/app.css app/**/*.vue
```
