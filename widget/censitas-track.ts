// import('https://censitas.example.com/v1/track.js?site=sonotas')
//
// Counts what happens on a page, never who did it: no cookie, no storage, no identifier, nothing
// read from the browser. Each event is one beacon to the censitas this script came from, sent as
// text/plain so the browser needs no preflight. A page view is counted on import.
const script = new URL(import.meta.url)
const site = script.searchParams.get('site')
const endpoint = new URL('e', script).href

/** Counts `event` with `props`; both must be listed for the site in censitas, or it is refused. */
export function track(event: string, props?: Record<string, string>) {
  if (site) navigator.sendBeacon(endpoint, JSON.stringify({ site, event, props }))
}

track('pageview')
