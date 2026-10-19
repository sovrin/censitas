// The sites censitas counts for, and what each one may send.
import type { DatabaseSync } from 'node:sqlite'
import { beaconSchema, type Refusal, type SiteConfig } from '../../shared/contracts'
import { transaction } from './database'

interface SiteRow {
  id: string
  origins: string
  events: string
}

const toConfig = (row: SiteRow): SiteConfig => ({
  id: row.id,
  origins: JSON.parse(row.origins),
  events: JSON.parse(row.events),
})

export function listSites(db: DatabaseSync): SiteConfig[] {
  return (db.prepare('SELECT * FROM sites ORDER BY id').all() as unknown as SiteRow[]).map(toConfig)
}

export function getSite(db: DatabaseSync, id: string): SiteConfig | null {
  const row = db.prepare('SELECT * FROM sites WHERE id = ?').get(id) as SiteRow | undefined
  return row ? toConfig(row) : null
}

/** False when a site with this id exists already. */
export function createSite(db: DatabaseSync, site: SiteConfig, now = Date.now()) {
  return (
    db
      .prepare(
        `INSERT OR IGNORE INTO sites (id, origins, events, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?)`,
      )
      .run(site.id, JSON.stringify(site.origins), JSON.stringify(site.events), now, now).changes ===
    1
  )
}

/** The id never changes: the tracker in the site's pages names it. */
export function updateSite(db: DatabaseSync, id: string, site: SiteConfig, now = Date.now()) {
  return (
    db
      .prepare('UPDATE sites SET origins = ?, events = ?, updated_at = ? WHERE id = ?')
      .run(JSON.stringify(site.origins), JSON.stringify(site.events), now, id).changes === 1
  )
}

/** Deletes the site and every count it has. */
export function deleteSite(db: DatabaseSync, id: string) {
  return transaction(db, () => {
    db.prepare('DELETE FROM counts WHERE site = ?').run(id)
    db.prepare('DELETE FROM refusals WHERE site = ?').run(id)
    return db.prepare('DELETE FROM sites WHERE id = ?').run(id).changes === 1
  })
}

/** Adds the sites that are new and replaces the settings of those that exist, all or none.
 *  Counts stay as they are. */
export function importSites(db: DatabaseSync, sites: SiteConfig[], now = Date.now()) {
  return transaction(db, () => {
    const added: string[] = []
    const replaced: string[] = []
    for (const site of sites)
      if (createSite(db, site, now)) added.push(site.id)
      else {
        updateSite(db, site.id, site, now)
        replaced.push(site.id)
      }
    return { added, replaced }
  })
}

/** What gets counted once a beacon has passed every rule. */
export interface Accepted {
  site: string
  event: string
  props: Record<string, string>
}

/** A beacon turned away: the status and message to answer with, and for a configured site, why
 *  in one fixed word, to count. */
export interface Refused {
  status: number
  error: string
  refusal?: { site: string; reason: Refusal }
}

/** Checks a beacon's raw body against its site. Returns why it is refused, or what to count. Only names and values the site lists pass, so a forged beacon can at most add
 *  to a counter that exists already; it can never put new text in the database. */
export function acceptBeacon(
  findSite: (id: string) => SiteConfig | null,
  origin: string | undefined,
  body: string,
): Refused | Accepted {
  let json: unknown
  try {
    json = JSON.parse(body)
  } catch {
    return { status: 400, error: 'Send JSON.' }
  }
  const beacon = beaconSchema.safeParse(json)
  if (!beacon.success) return { status: 400, error: beacon.error.issues[0]!.message }
  const { site: id, event, props = {} } = beacon.data
  const site = findSite(id)
  // A site that isn't configured has nothing to count against: the id itself is untrusted text.
  if (!site) return { status: 403, error: 'This site may not send events here.' }
  const refuse = (status: number, error: string, reason: Refusal): Refused => ({
    status,
    error,
    refusal: { site: id, reason },
  })
  // A browser always sends Origin on a cross-site beacon; anything else did not come from the site.
  if (!origin || !site.origins.includes(origin))
    return refuse(403, 'This site may not send events here.', 'origin')
  const rules = Object.hasOwn(site.events, event) ? site.events[event] : undefined
  if (!rules) return refuse(400, `The event ${event} is not configured.`, 'event')
  for (const [key, value] of Object.entries(props)) {
    const values = Object.hasOwn(rules, key) ? rules[key] : undefined
    if (!values) return refuse(400, `The prop ${key} is not configured for ${event}.`, 'prop')
    if (!values.includes(value))
      return refuse(400, `The value ${value} is not configured for ${key}.`, 'value')
  }
  return { site: id, event, props }
}
