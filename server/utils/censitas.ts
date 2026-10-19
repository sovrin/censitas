import { resolve } from 'node:path'
import type { H3Event } from 'h3'
import { openDatabase } from '../core/database'
import { senderNetwork } from '../core/limits'
import { loadSites } from '../core/sites'

let database: ReturnType<typeof openDatabase> | undefined
let sites: ReturnType<typeof loadSites> | undefined

export function censitasDatabase() {
  const dataDir = process.env.CENSITAS_DATA_DIR
  if (!dataDir) throw new Error('CENSITAS_DATA_DIR must be set for the web server.')
  return (database ??= openDatabase(resolve(dataDir)))
}

/** The sites file, read once: a change to it takes a restart. */
export function censitasSites() {
  const path = process.env.CENSITAS_SITES
  if (!path) throw new Error('CENSITAS_SITES must point at the sites file.')
  return (sites ??= loadSites(resolve(path)))
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
