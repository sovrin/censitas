import { sitesFileSchema } from '#shared/contracts'
import { importSites } from '../core/sites'
import { censitasDatabase } from '../utils/censitas'
import { announceChange } from '../utils/changes'
import { invalid } from '../utils/invalid'

/** Adds the file's new sites and replaces the settings of the ones that exist. */
export default defineEventHandler(async (event) => {
  const body = sitesFileSchema.safeParse(await readBody(event))
  if (!body.success) throw invalid(body.error)
  const result = importSites(censitasDatabase(), body.data.sites)
  announceChange()
  return result
})
