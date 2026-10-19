import type { SitesFile } from '#shared/contracts'
import { dayOf } from '../core/counts'
import { listSites } from '../core/sites'
import { censitasDatabase } from '../utils/censitas'

/** Every site's settings as a file, to import into another censitas or keep as a backup. */
export default defineEventHandler((event): SitesFile => {
  setHeader(
    event,
    'Content-Disposition',
    `attachment; filename="censitas-sites-${dayOf(Date.now())}.json"`,
  )
  return { censitas: 1, sites: listSites(censitasDatabase()) }
})
