import { siteSettingsSchema } from '../../../../../shared/contracts'
import { createSite, getProjectSite } from '../../../../core/sites'
import { nexitasDatabase } from '#nexitas/server/utils/nexitas'
import { requestProject } from '#nexitas/server/utils/projects'
import { announceChange } from '#nexitas/server/utils/changes'
import { invalid } from '#nexitas/server/utils/invalid'

/** Starts counting for the project. */
export default defineEventHandler(async (event) => {
  const project = requestProject(event)
  const body = siteSettingsSchema.safeParse(await readBody(event))
  if (!body.success) throw invalid(body.error)
  const db = nexitasDatabase()
  if (!createSite(db, project.id, body.data.events))
    throw createError({ statusCode: 409, statusMessage: 'This project is counted already.' })
  announceChange()
  setResponseStatus(event, 201)
  return getProjectSite(db, project.id)
})
