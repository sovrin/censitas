import { siteConfigSchema } from '#shared/contracts'
import { createSite } from '../../core/sites'
import { censitasDatabase } from '../../utils/censitas'
import { invalid } from '../../utils/invalid'

export default defineEventHandler(async (event) => {
  const body = siteConfigSchema.safeParse(await readBody(event))
  if (!body.success) throw invalid(body.error)
  if (!createSite(censitasDatabase(), body.data))
    throw createError({ statusCode: 409, statusMessage: 'A site with this id exists already.' })
  setResponseStatus(event, 201)
  return body.data
})
