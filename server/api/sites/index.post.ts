import { newSiteSchema } from '../../../shared/contracts'
import { createSite, getProjectSite } from '../../core/sites'
import { getProject } from '#nexitas/server/core/projects'
import { nexitasDatabase } from '#nexitas/server/utils/nexitas'
import { announceChange } from '#nexitas/server/utils/changes'
import { invalid } from '#nexitas/server/utils/invalid'

/** Starts counting for a project: its site takes the project's id. */
export default defineEventHandler(async (event) => {
  const body = newSiteSchema.safeParse(await readBody(event))
  if (!body.success) throw invalid(body.error)
  const db = nexitasDatabase()
  if (!getProject(db, body.data.projectId))
    throw createError({ statusCode: 404, statusMessage: 'There is no such project.' })
  if (!createSite(db, body.data.projectId, body.data.events))
    throw createError({ statusCode: 409, statusMessage: 'This project is counted already.' })
  announceChange()
  setResponseStatus(event, 201)
  return getProjectSite(db, body.data.projectId)
})
