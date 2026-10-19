import { RANGES } from '#shared/contracts'
import { siteReport } from '../../../core/counts'
import { censitasDatabase, routeSite } from '../../../utils/censitas'

export default defineEventHandler((event) => {
  const site = routeSite(event)
  // Anything but an offered range is the default, 30 days.
  const days = RANGES.find((range) => String(range) === getQuery(event).days) ?? 30
  return siteReport(censitasDatabase(), site, days)
})
