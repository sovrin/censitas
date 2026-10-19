import { deleteSite } from '../../../core/sites'
import { censitasDatabase, routeSite } from '../../../utils/censitas'

export default defineEventHandler((event) => {
  deleteSite(censitasDatabase(), routeSite(event).id)
  return { ok: true }
})
