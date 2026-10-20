import type { H3Event } from 'h3'
import { pacedAnnouncer } from '#nexitas/server/utils/changes'
import { nexitasDatabase } from '#nexitas/server/utils/nexitas'
import { getSite } from '../core/sites'

/** The site named in the route, or a 404. */
export function routeSite(event: H3Event) {
  const site = getSite(nexitasDatabase(), getRouterParam(event, 'id') ?? '')
  if (!site) throw createError({ statusCode: 404, statusMessage: 'This site is not configured.' })
  return site
}

/** A beacon was counted or refused. A busy site sends beacons all the time, so open dashboards
 *  hear about them at most every 3 s, together with any others that arrive meanwhile. */
export const announceBeacon = pacedAnnouncer(3000)
