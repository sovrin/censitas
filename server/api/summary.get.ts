import { countToday } from '../core/counts'
import { censitasDatabase, censitasSites } from '../utils/censitas'

/** The status line under every page: events today, and how many sites send them. */
export default defineEventHandler(() => ({
  today: countToday(censitasDatabase()),
  siteCount: Object.keys(censitasSites()).length,
}))
