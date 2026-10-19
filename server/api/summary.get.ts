import { countToday } from '../core/counts'
import { listSites } from '../core/sites'
import { censitasDatabase } from '../utils/censitas'

/** The status line under every page: events today, and how many sites send them. */
export default defineEventHandler(() => {
  const db = censitasDatabase()
  return { today: countToday(db), siteCount: listSites(db).length }
})
