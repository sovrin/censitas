import { clearRefusals } from '../../../../core/counts'
import { censitasDatabase, routeSite } from '../../../../utils/censitas'
import { announceChange } from '../../../../utils/changes'

/** The owner has dealt with the refused beacons: forget them, so only new ones show. */
export default defineEventHandler((event) => {
  clearRefusals(censitasDatabase(), routeSite(event).id)
  announceChange()
  return { ok: true }
})
