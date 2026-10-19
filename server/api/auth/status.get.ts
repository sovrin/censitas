import type { AuthStatus } from '#shared/contracts'
import { getOwner, sessionOwner } from '../../core/auth'
import { SESSION_COOKIE } from '../../utils/auth'
import { censitasDatabase } from '../../utils/censitas'

export default defineEventHandler((event): AuthStatus => {
  const db = censitasDatabase()
  return { setupRequired: !getOwner(db), owner: sessionOwner(db, getCookie(event, SESSION_COOKIE)) }
})
