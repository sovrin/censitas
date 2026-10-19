import type { H3Event } from 'h3'
import { requireOwner } from '../utils/auth'
import { censitasOrigin } from '../utils/censitas'

// Two kinds of API live here. /api/* is the dashboard's: the owner's session, and for writes the
// exact CENSITAS_ORIGIN. /v1/* is public on purpose: sites load the tracker and send beacons.
// Pages themselves hold no data; the auth middleware in app/ sends a visitor to sign in.
const OPEN_API = /^\/api\/(health|auth\/.+)$/
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
  // Nuxt renders an error as a page unless the request asks for JSON, and the page's sign-in
  // redirect would answer a refused beacon with a 302. A beacon's answer is JSON.
  if (path === '/v1/e') event.node.req.headers.accept = 'application/json'
  const reads = ['GET', 'HEAD', 'OPTIONS'].includes(event.method)
  if (!reads) limitBody(event, path === '/v1/e' ? MAX_BEACON : MAX_BODY)
  if (path === '/v1/e') setHeader(event, 'Cache-Control', 'no-store')
  if (!path.startsWith('/api/')) return
  setHeader(event, 'Cache-Control', 'no-store')
  if (!reads) {
    // Compare with a configured origin, never with caller-controlled forwarded headers.
    if (getHeader(event, 'origin') !== censitasOrigin())
      throw createError({
        statusCode: 403,
        statusMessage: 'This request did not come from censitas.',
      })
    if (!getHeader(event, 'content-type')?.startsWith('application/json'))
      throw createError({ statusCode: 415, statusMessage: 'Send application/json.' })
  }
  if (!OPEN_API.test(path)) requireOwner(event)
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
