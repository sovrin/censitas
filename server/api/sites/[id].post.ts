import { siteSettingsSchema } from '../../../shared/contracts'
import { getSite, updateSite } from '../../core/sites'
import { nexitasDatabase } from '#nexitas/server/utils/nexitas'
import { routeSite } from '../../utils/censitas'
import { announceChange } from '#nexitas/server/utils/changes'
import { invalid } from '#nexitas/server/utils/invalid'

export default defineEventHandler(async (event) => {
  const site = routeSite(event)
  const body = siteSettingsSchema.safeParse(await readBody(event))
  if (!body.success) throw invalid(body.error)
  const db = nexitasDatabase()
  updateSite(db, site.id, body.data.events)
  announceChange()
  return getSite(db, site.id)
})
