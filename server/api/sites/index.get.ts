import { siteSummaries } from '../../core/counts'
import { censitasDatabase, censitasSites } from '../../utils/censitas'

export default defineEventHandler(() => siteSummaries(censitasDatabase(), censitasSites()))
