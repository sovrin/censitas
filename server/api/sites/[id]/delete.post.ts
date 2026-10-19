import { deleteSite } from '../../../core/sites'
import { announceChange } from '../../../utils/changes'
import { censitasDatabase, routeSite } from '../../../utils/censitas'

export default defineEventHandler((event) => {
  deleteSite(censitasDatabase(), routeSite(event).id)
  announceChange()
  return { ok: true }
})
