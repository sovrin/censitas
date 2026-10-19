import { siteSummaries } from '../../core/counts'
import { listSites } from '../../core/sites'
import { censitasDatabase } from '../../utils/censitas'

export default defineEventHandler(() => {
  const db = censitasDatabase()
  return siteSummaries(db, listSites(db))
})
