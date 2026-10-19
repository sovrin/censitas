import type { H3Event } from 'h3'
import { requireOwner } from '../utils/auth'

// Everything is the owner's dashboard behind basic auth, except what sites and the proxy call:
// the tracker, its beacons and the health check. Nuxt renders every error page through an
// internal request to /__nuxt_error, which holds only the status and message it is given.
const PUBLIC = new Set(['/v1/track.js', '/v1/e', '/api/health', '/favicon.svg', '/__nuxt_error'])
// A beacon is well under 1 kB. Checked here, not left to whichever proxy is in front.
const MAX_BODY = 4 * 1024

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
  if (!['GET', 'HEAD', 'OPTIONS'].includes(event.method)) limitBody(event)
  const path = event.path.split('?')[0]!
  if (path.startsWith('/api/') || path === '/v1/e') setHeader(event, 'Cache-Control', 'no-store')
  if (PUBLIC.has(path)) return
  requireOwner(event)
})

/** A body must announce its length, and stay under MAX_BODY. Browsers always send the length for
 *  beacons; a body without one (chunked) could grow without end before it is read. */
function limitBody(event: H3Event) {
  const length = Number(getHeader(event, 'content-length') ?? Number.NaN)
  if (Number.isNaN(length))
    throw createError({ statusCode: 411, statusMessage: 'Send the body with a Content-Length.' })
  if (length > MAX_BODY)
    throw createError({ statusCode: 413, statusMessage: 'This request is too large.' })
}
