import type { ProjectUsage } from '#self/shared/contracts'
import { countToday } from '#self/server/core/counts'
import { getProjectSite } from '#self/server/core/sites'
import { nexitasDatabase } from '#nexitas/server/utils/nexitas'
import { requestProject } from '#nexitas/server/utils/projects'

// A project's site, if it counts, and today's count: for Usage's setup.
export default defineEventHandler((event) => {
  const db = nexitasDatabase()
  const site = getProjectSite(db, requestProject(event).id)
  return { site, today: site ? countToday(db, site.id) : 0 } satisfies ProjectUsage
})
