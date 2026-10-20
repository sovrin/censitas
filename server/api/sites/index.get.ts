import type { ProjectUsage } from '../../../shared/contracts'
import { countToday, siteSummaries } from '../../core/counts'
import { getProjectSite, listSites } from '../../core/sites'
import { nexitasDatabase } from '#nexitas/server/utils/nexitas'

// Every site's summary, or with ?project= that project's site and today's count, for its panel
// on the project's page.
export default defineEventHandler((event) => {
  const db = nexitasDatabase()
  const project = getQuery(event).project
  if (typeof project !== 'string') return siteSummaries(db, listSites(db))
  const site = getProjectSite(db, project)
  return { site, today: site ? countToday(db, Date.now(), site.id) : 0 } satisfies ProjectUsage
})
