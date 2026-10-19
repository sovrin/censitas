// The sites censitas counts for, read from a JSON file, and what each one may send.
import { readFileSync } from 'node:fs'
import { z } from 'zod'
import { beaconSchema, sitesSchema, type Sites } from '../../shared/contracts'

/** Reads and checks the sites file; a mistake in it stops the server with the reason. */
export function loadSites(path: string): Sites {
  const parsed = sitesSchema.safeParse(JSON.parse(readFileSync(path, 'utf8')))
  if (!parsed.success)
    throw new Error(`${path} is not a valid sites file:\n${z.prettifyError(parsed.error)}`)
  return parsed.data
}

/** What gets counted once a beacon has passed every rule. */
export interface Accepted {
  site: string
  event: string
  props: Record<string, string>
}

/** Checks a beacon's raw body against the sites. Returns why it is refused, with a status, or
 *  what to count. Only names and values the site lists pass, so a forged beacon can at most add
 *  to a counter that exists already; it can never put new text in the database. */
export function acceptBeacon(
  sites: Sites,
  origin: string | undefined,
  body: string,
): { status: number; error: string } | Accepted {
  let json: unknown
  try {
    json = JSON.parse(body)
  } catch {
    return { status: 400, error: 'Send JSON.' }
  }
  const beacon = beaconSchema.safeParse(json)
  if (!beacon.success) return { status: 400, error: beacon.error.issues[0]!.message }
  const { site: id, event, props = {} } = beacon.data
  const site = Object.hasOwn(sites, id) ? sites[id] : undefined
  // A browser always sends Origin on a cross-site beacon; anything else did not come from the site.
  if (!site || !origin || !site.origins.includes(origin))
    return { status: 403, error: 'This site may not send events here.' }
  const rules = Object.hasOwn(site.events, event) ? site.events[event] : undefined
  if (!rules) return { status: 400, error: `The event ${event} is not configured.` }
  for (const [key, value] of Object.entries(props)) {
    const values = Object.hasOwn(rules, key) ? rules[key] : undefined
    if (!values) return { status: 400, error: `The prop ${key} is not configured for ${event}.` }
    if (!values.includes(value))
      return { status: 400, error: `The value ${value} is not configured for ${key}.` }
  }
  return { site: id, event, props }
}
