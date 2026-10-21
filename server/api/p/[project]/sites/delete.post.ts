import { deleteSite } from '../../../../core/sites'
import { announceChange } from '#nexitas/server/utils/changes'
import { nexitasDatabase } from '#nexitas/server/utils/nexitas'
import { projectSite } from '../../../../utils/censitas'

export default defineEventHandler((event) => {
  deleteSite(nexitasDatabase(), projectSite(event).id)
  announceChange()
  return { ok: true }
})
