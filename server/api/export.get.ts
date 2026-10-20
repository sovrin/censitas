import type { SitesFile } from '../../shared/contracts'
import { dayOf } from '../core/counts'
import { listSites } from '../core/sites'
import { nexitasDatabase } from '#nexitas/server/utils/nexitas'

/** Every site's settings as a file, to import into another censitas or keep as a backup. Each
 *  carries its project's origins, so the file is complete on its own. */
export default defineEventHandler((event): SitesFile => {
  setHeader(
    event,
    'Content-Disposition',
    `attachment; filename="censitas-sites-${dayOf(Date.now())}.json"`,
  )
  return {
    censitas: 1,
    sites: listSites(nexitasDatabase()).map(({ id, origins, events }) => ({ id, origins, events })),
  }
})
