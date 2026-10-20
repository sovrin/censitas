import { deleteCounts } from '../../../../core/sites'
import { nexitasDatabase } from '#nexitas/server/utils/nexitas'
import { routeSite } from '../../../../utils/censitas'
import { announceChange } from '#nexitas/server/utils/changes'

/** Deletes everything the site counted and refused; its settings and tracker stay. */
export default defineEventHandler((event) => {
  deleteCounts(nexitasDatabase(), routeSite(event).id)
  announceChange()
  return { ok: true }
})
