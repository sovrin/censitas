// Abuse checks that keep nothing: a beacon's sender is counted in memory for a minute, then the
// whole table is dropped. No address or user agent reaches the database or the log.

/** Allows `limit` hits per key in each fixed window. All keys are forgotten when a window ends,
 *  so the table holds only the senders of the current window. */
export function createLimiter(limit: number, windowMs: number) {
  const hits = new Map<string, number>()
  let resetsAt = 0
  const count = (key: string, now: number) => {
    if (now >= resetsAt) {
      hits.clear()
      resetsAt = now + windowMs
    }
    return hits.get(key) ?? 0
  }
  return {
    /** True while `key` has hits left in this window. */
    allows: (key: string, now = Date.now()) => count(key, now) < limit,
    /** Counts a hit; true when it was allowed. */
    hit: (key: string, now = Date.now()) => {
      const next = count(key, now) + 1
      hits.set(key, next)
      return next <= limit
    },
  }
}

/** The network a sender is counted by: an IPv6 address cut to its /64, which one connection
 *  usually holds whole (otherwise every request could come from a new address); an IPv4
 *  address, also one mapped into IPv6, as it is. */
export function senderNetwork(address: string) {
  const plain = address.replace(/%.*$/, '').toLowerCase()
  if (!plain.includes(':')) return plain
  if (plain.includes('.')) return plain.slice(plain.lastIndexOf(':') + 1)
  const [head = '', tail] = plain.split('::')
  const left = head ? head.split(':') : []
  const right = tail ? tail.split(':') : []
  const groups =
    tail === undefined
      ? left
      : [...left, ...Array<string>(Math.max(0, 8 - left.length - right.length)).fill('0'), ...right]
  return `${groups
    .slice(0, 4)
    .map((group) => Number.parseInt(group || '0', 16).toString(16))
    .join(':')}::/64`
}

// shortcut: a list of the usual crawler, preview and script agents; a bot that sends a browser's
// user agent is counted. Extend the list when a dashboard shows one.
const BOTS =
  /bot|crawl|spider|slurp|archiver|preview|headless|lighthouse|pagespeed|phantom|puppeteer|playwright|selenium|curl|wget|python|httpclient|okhttp|axios|node-fetch|undici|go-http|java\/|libwww|scrapy|monitor|uptime/i

/** A request without a user agent, or with one of a known bot. */
export const isBot = (userAgent: string | undefined) => !userAgent || BOTS.test(userAgent)
