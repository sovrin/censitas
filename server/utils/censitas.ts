import { resolve } from 'node:path'
import type { H3Event } from 'h3'
import { openDatabase } from '../core/database'
import { senderNetwork } from '../core/limits'
import { getSite } from '../core/sites'

let database: ReturnType<typeof openDatabase> | undefined

export function censitasDatabase() {
  const dataDir = process.env.CENSITAS_DATA_DIR
  if (!dataDir) throw new Error('CENSITAS_DATA_DIR must be set for the web server.')
  return (database ??= openDatabase(resolve(dataDir)))
}

/** Where the dashboard lives; its own writes must come from here. */
export function censitasOrigin() {
  const configured = process.env.CENSITAS_ORIGIN
  if (!configured) throw new Error('CENSITAS_ORIGIN must be set for the web server.')
  return new URL(configured).origin
}

/** The site named in the route, or a 404. */
export function routeSite(event: H3Event) {
  const site = getSite(censitasDatabase(), getRouterParam(event, 'id') ?? '')
  if (!site) throw createError({ statusCode: 404, statusMessage: 'This site is not configured.' })
  return site
}

/** Who is asking, for the in-memory limits only. The proxy in front appends the address it saw
 *  as the last X-Forwarded-For entry; earlier ones come from the client. */
// shortcut: assumes exactly one proxy in front (Caddy, nginx); behind a CDN as well, count hops.
export function requestSender(event: H3Event) {
  return senderNetwork(
    getHeader(event, 'x-forwarded-for')?.split(',').at(-1)?.trim() ||
      getRequestIP(event) ||
      'unknown',
  )
}
