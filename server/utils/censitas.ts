import type { H3Event } from 'h3'
import { pacedAnnouncer } from '#nexitas/server/utils/changes'
import { nexitasDatabase } from '#nexitas/server/utils/nexitas'
import { requestProject } from '#nexitas/server/utils/projects'
import { getProjectSite } from '../core/sites'

/** The site of the request's project, or a 404 when the project doesn't count. */
export function projectSite(event: H3Event) {
  const site = getProjectSite(nexitasDatabase(), requestProject(event).id)
  if (!site) throw createError({ statusCode: 404, statusMessage: 'This project does not count.' })
  return site
}

/** A beacon was counted or refused. A busy site sends beacons all the time, so open dashboards
 *  hear about them at most every 3 s, together with any others that arrive meanwhile. */
export const announceBeacon = pacedAnnouncer(3000)
