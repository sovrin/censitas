import type { ProjectUsage } from '../../../../../shared/contracts'
import { countToday } from '../../../../core/counts'
import { getProjectSite } from '../../../../core/sites'
import { nexitasDatabase } from '#nexitas/server/utils/nexitas'
import { requestProject } from '#nexitas/server/utils/projects'

// A project's site, if it counts, and today's count: for its panel and its settings page.
export default defineEventHandler((event) => {
  const db = nexitasDatabase()
  const site = getProjectSite(db, requestProject(event).id)
  return { site, today: site ? countToday(db, site.id) : 0 } satisfies ProjectUsage
})
