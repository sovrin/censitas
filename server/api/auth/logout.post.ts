import { revokeSession } from '../../core/auth'
import { SESSION_COOKIE } from '../../utils/auth'
import { censitasDatabase } from '../../utils/censitas'

export default defineEventHandler((event) => {
  revokeSession(censitasDatabase(), getCookie(event, SESSION_COOKIE))
  deleteCookie(event, SESSION_COOKIE, { path: '/' })
  return { ok: true }
})
