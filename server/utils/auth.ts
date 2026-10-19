import { createHash, timingSafeEqual } from 'node:crypto'
import type { H3Event } from 'h3'
import { createLimiter } from '../core/limits'
import { requestSender } from './censitas'

const hash = (value: string) => createHash('sha256').update(value).digest()
// Ten wrong passwords per sender in 15 minutes, a hundred for everyone: a guesser gets nowhere,
// and one sender cannot lock the owner out.
const perSender = createLimiter(10, 15 * 60 * 1000)
const everyone = createLimiter(100, 15 * 60 * 1000)

/** The dashboard's HTTP basic auth, against CENSITAS_USER and CENSITAS_PASSWORD. */
export function requireOwner(event: H3Event) {
  const user = process.env.CENSITAS_USER
  const password = process.env.CENSITAS_PASSWORD
  if (!user || !password || password.length < 12)
    throw createError({
      statusCode: 503,
      statusMessage: 'Set CENSITAS_USER and a CENSITAS_PASSWORD of at least 12 characters.',
    })
  const given = getHeader(event, 'authorization')?.match(/^Basic ([A-Za-z0-9+/=]{1,512})$/)?.[1]
  if (given) {
    // Checked before the password, so a sender out of attempts learns nothing more.
    const sender = requestSender(event)
    if (!perSender.allows(sender) || !everyone.allows('all'))
      throw createError({ statusCode: 429, statusMessage: 'Too many attempts. Try again later.' })
    const decoded = Buffer.from(given, 'base64').toString('utf8')
    if (timingSafeEqual(hash(decoded), hash(`${user}:${password}`))) return
    perSender.hit(sender)
    everyone.hit('all')
  }
  setHeader(event, 'WWW-Authenticate', 'Basic realm="censitas", charset="UTF-8"')
  throw createError({ statusCode: 401, statusMessage: 'Sign in to continue.' })
}
