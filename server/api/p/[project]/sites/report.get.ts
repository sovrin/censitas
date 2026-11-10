import { RANGES } from '#self/shared/contracts'
import { siteReport } from '#self/server/core/counts'
import { nexitasDatabase } from '#nexitas/server/utils/nexitas'
import { projectSite } from '#self/server/utils/censitas'

export default defineEventHandler((event) => {
  const site = projectSite(event)
  // Anything but an offered range is the default, 30 days.
  const days = RANGES.find((range) => String(range) === getQuery(event).days) ?? 30
  return siteReport(nexitasDatabase(), site, days)
})
