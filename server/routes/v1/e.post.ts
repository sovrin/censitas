import { countEvent } from '../../core/counts'
import { createLimiter, isBot } from '../../core/limits'
import { acceptBeacon } from '../../core/sites'
import { censitasDatabase, censitasSites, requestSender } from '../../utils/censitas'

// A visitor sends a page view and a handful of events; a script sending more is not one.
const perSender = createLimiter(60, 60 * 1000)

// One beacon from track.js. Nobody reads the answer, so every refusal is only for whoever debugs
// a site in its network panel. The address and user agent are looked at here and never kept.
export default defineEventHandler(async (event) => {
  setResponseStatus(event, 204)
  // A bot hears success and nothing is counted.
  if (isBot(getHeader(event, 'user-agent'))) return null
  const accepted = acceptBeacon(
    censitasSites(),
    getHeader(event, 'origin'),
    (await readRawBody(event, 'utf8')) ?? '',
  )
  if ('error' in accepted)
    throw createError({ statusCode: accepted.status, statusMessage: accepted.error })
  if (!perSender.hit(requestSender(event)))
    throw createError({ statusCode: 429, statusMessage: 'Too many events. Try again later.' })
  countEvent(censitasDatabase(), accepted.site, accepted.event, accepted.props)
  return null
})
