import { clearRefusals } from '../../../../../core/counts'
import { nexitasDatabase } from '#nexitas/server/utils/nexitas'
import { projectSite } from '../../../../../utils/censitas'
import { announceChange } from '#nexitas/server/utils/changes'

/** The owner has dealt with the refused beacons: forget them, so only new ones show. */
export default defineEventHandler((event) => {
  clearRefusals(nexitasDatabase(), projectSite(event).id)
  announceChange()
  return { ok: true }
})
