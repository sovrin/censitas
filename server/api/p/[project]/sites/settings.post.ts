import { siteSettingsSchema } from '#self/shared/contracts'
import { getSite, updateSite } from '#self/server/core/sites'
import { nexitasDatabase } from '#nexitas/server/utils/nexitas'
import { projectSite } from '#self/server/utils/censitas'
import { announceChange } from '#nexitas/server/utils/changes'
import { invalid } from '#nexitas/server/utils/invalid'

export default defineEventHandler(async (event) => {
  const site = projectSite(event)
  const body = siteSettingsSchema.safeParse(await readBody(event))
  if (!body.success) throw invalid(body.error)
  const db = nexitasDatabase()
  updateSite(db, site.id, body.data.events)
  announceChange()
  return getSite(db, site.id)
})
