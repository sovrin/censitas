import { deleteCounts } from '../../../../core/sites'
import { censitasDatabase, routeSite } from '../../../../utils/censitas'
import { announceChange } from '../../../../utils/changes'

/** Deletes everything the site counted and refused; its settings and tracker stay. */
export default defineEventHandler((event) => {
  deleteCounts(censitasDatabase(), routeSite(event).id)
  announceChange()
  return { ok: true }
})
