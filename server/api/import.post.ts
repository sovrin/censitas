import { sitesFileSchema } from '#shared/contracts'
import { importSites } from '../core/sites'
import { censitasDatabase } from '../utils/censitas'
import { invalid } from '../utils/invalid'

/** Adds the file's new sites and replaces the settings of the ones that exist. */
export default defineEventHandler(async (event) => {
  const body = sitesFileSchema.safeParse(await readBody(event))
  if (!body.success) throw invalid(body.error)
  return importSites(censitasDatabase(), body.data.sites)
})
