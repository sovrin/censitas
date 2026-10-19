import { countEvent, countRefusal } from '../../core/counts'
import { createLimiter, isBot } from '../../core/limits'
import { acceptBeacon, getSite } from '../../core/sites'
import { censitasDatabase, requestSender } from '../../utils/censitas'
import { announceBeacon } from '../../utils/changes'

// A visitor sends a page view and a handful of events; a script sending more is not one.
const perSender = createLimiter(60, 60 * 1000)

// One beacon from track.js. Nobody reads the answer, so every refusal is only for whoever debugs
// a site in its network panel. The address and user agent are looked at here and never kept.
export default defineEventHandler(async (event) => {
  setResponseStatus(event, 204)
  // A bot hears success and nothing is counted.
  if (isBot(getHeader(event, 'user-agent'))) return null
  const db = censitasDatabase()
  const accepted = acceptBeacon(
    (id) => getSite(db, id),
    getHeader(event, 'origin'),
    (await readRawBody(event, 'utf8')) ?? '',
  )
  // Only a beacon for a configured site counts against its sender, and a sender out of beacons
  // can raise no counter at all, refused ones included.
  if (('error' in accepted ? accepted.refusal : accepted) && !perSender.hit(requestSender(event)))
    throw createError({ statusCode: 429, statusMessage: 'Too many events. Try again later.' })
  if ('error' in accepted) {
    if (accepted.refusal) {
      countRefusal(db, accepted.refusal.site, accepted.refusal.reason)
      announceBeacon()
    }
    throw createError({ statusCode: accepted.status, statusMessage: accepted.error })
  }
  countEvent(db, accepted.site, accepted.event, accepted.props)
  announceBeacon()
  return null
})
