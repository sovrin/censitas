import { sitesFileSchema } from '../../shared/contracts'
import { importSites, SiteConflict } from '../core/sites'
import { nexitasDatabase } from '#nexitas/server/utils/nexitas'
import { announceChange } from '#nexitas/server/utils/changes'
import { invalid } from '#nexitas/server/utils/invalid'

/** Adds the file's new sites and replaces the settings of the ones that exist, all or none. */
export default defineEventHandler(async (event) => {
  const body = sitesFileSchema.safeParse(await readBody(event))
  if (!body.success) throw invalid(body.error)
  let result
  try {
    result = importSites(nexitasDatabase(), body.data.sites)
  } catch (cause) {
    // Nothing was imported.
    if (cause instanceof SiteConflict)
      throw createError({ statusCode: 409, statusMessage: cause.message })
    throw cause
  }
  announceChange()
  return result
})
