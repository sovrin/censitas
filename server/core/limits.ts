// Abuse checks that keep nothing. A beacon's sender is counted in memory for a minute by nexitas'
// createLimiter, then the whole table is dropped; the user agent is looked at here, and dropped.
// No address or user agent reaches the database or the log.

// shortcut: a list of the usual crawler, preview and script agents; a bot that sends a browser's
// user agent is counted. Extend the list when a dashboard shows one.
const BOTS =
  /bot|crawl|spider|slurp|archiver|preview|headless|lighthouse|pagespeed|phantom|puppeteer|playwright|selenium|curl|wget|python|httpclient|okhttp|axios|node-fetch|undici|go-http|java\/|libwww|scrapy|monitor|uptime/i

/** A request without a user agent, or with one of a known bot. */
export const isBot = (userAgent: string | undefined) => !userAgent || BOTS.test(userAgent)
