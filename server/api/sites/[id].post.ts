import { siteConfigSchema } from '#shared/contracts'
import { updateSite } from '../../core/sites'
import { censitasDatabase, routeSite } from '../../utils/censitas'
import { announceChange } from '../../utils/changes'
import { invalid } from '../../utils/invalid'

export default defineEventHandler(async (event) => {
  const site = routeSite(event)
  const body = siteConfigSchema.safeParse(await readBody(event))
  if (!body.success) throw invalid(body.error)
  if (body.data.id !== site.id)
    throw createError({ statusCode: 400, statusMessage: 'A site keeps its id.' })
  updateSite(censitasDatabase(), site.id, body.data)
  announceChange()
  return body.data
})
