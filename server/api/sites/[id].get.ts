import { RANGES } from '#shared/contracts'
import { siteReport } from '../../core/counts'
import { censitasDatabase, censitasSites } from '../../utils/censitas'

export default defineEventHandler((event) => {
  const id = getRouterParam(event, 'id') ?? ''
  const sites = censitasSites()
  const site = Object.hasOwn(sites, id) ? sites[id] : undefined
  if (!site) throw createError({ statusCode: 404, statusMessage: 'This site is not configured.' })
  // Anything but an offered range is the default, 30 days.
  const days = RANGES.find((range) => String(range) === getQuery(event).days) ?? 30
  return siteReport(censitasDatabase(), id, site, days)
})
