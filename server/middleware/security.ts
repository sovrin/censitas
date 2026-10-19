import type { H3Event } from 'h3'
import { requireOwner } from '../utils/auth'
import { censitasOrigin } from '../utils/censitas'

// Everything is the owner's dashboard behind basic auth, except what sites and the proxy call:
// the tracker, its beacons and the health check. Nuxt renders every error page through an
// internal request to /__nuxt_error, which holds only the status and message it is given.
const PUBLIC = new Set(['/v1/track.js', '/v1/e', '/api/health', '/favicon.svg', '/__nuxt_error'])
// A beacon is well under 1 kB, a site's settings a few kB. Checked here, not left to whichever
// proxy is in front.
const MAX_BEACON = 4 * 1024
const MAX_BODY = 64 * 1024

export default defineEventHandler((event) => {
  setHeader(event, 'X-Content-Type-Options', 'nosniff')
  setHeader(event, 'X-Frame-Options', 'DENY')
  setHeader(event, 'Referrer-Policy', 'same-origin')
  // shortcut: no script-src, since Nuxt inlines its config script; add nonces if pages ever
  // render HTML from what sites send.
  setHeader(
    event,
    'Content-Security-Policy',
    "object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
  )
  const path = event.path.split('?')[0]!
  if (!['GET', 'HEAD', 'OPTIONS'].includes(event.method))
    limitBody(event, path === '/v1/e' ? MAX_BEACON : MAX_BODY)
  if (path.startsWith('/api/') || path === '/v1/e') setHeader(event, 'Cache-Control', 'no-store')
  if (PUBLIC.has(path)) return
  requireOwner(event)
  if (['GET', 'HEAD', 'OPTIONS'].includes(event.method)) return
  // A browser sends basic auth along with any site's request, so a write must prove it came from
  // the dashboard. Compare with a configured origin, never with caller-controlled forwarded headers.
  if (getHeader(event, 'origin') !== censitasOrigin())
    throw createError({
      statusCode: 403,
      statusMessage: 'This request did not come from censitas.',
    })
  if (!getHeader(event, 'content-type')?.startsWith('application/json'))
    throw createError({ statusCode: 415, statusMessage: 'Send application/json.' })
})

/** A body must announce its length, and stay under `max`. Browsers always send the length for
 *  these requests; a body without one (chunked) could grow without end before it is read. */
function limitBody(event: H3Event, max: number) {
  const length = Number(getHeader(event, 'content-length') ?? Number.NaN)
  if (Number.isNaN(length))
    throw createError({ statusCode: 411, statusMessage: 'Send the body with a Content-Length.' })
  if (length > max)
    throw createError({ statusCode: 413, statusMessage: 'This request is too large.' })
}
