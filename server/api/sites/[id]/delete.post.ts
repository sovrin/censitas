import { deleteSite } from '../../../core/sites'
import { announceChange } from '#nexitas/server/utils/changes'
import { nexitasDatabase } from '#nexitas/server/utils/nexitas'
import { routeSite } from '../../../utils/censitas'

export default defineEventHandler((event) => {
  deleteSite(nexitasDatabase(), routeSite(event).id)
  announceChange()
  return { ok: true }
})
