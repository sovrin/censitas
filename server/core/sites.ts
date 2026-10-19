// The sites censitas counts for, and what each one may send.
import type { DatabaseSync } from 'node:sqlite'
import { beaconSchema, type SiteConfig } from '../../shared/contracts'
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
    return db.prepare('DELETE FROM sites WHERE id = ?').run(id).changes === 1
  })
}

/** What gets counted once a beacon has passed every rule. */
export interface Accepted {
  site: string
  event: string
  props: Record<string, string>
}

/** Checks a beacon's raw body against its site. Returns why it is refused, with a status, or
 *  what to count. Only names and values the site lists pass, so a forged beacon can at most add
 *  to a counter that exists already; it can never put new text in the database. */
export function acceptBeacon(
  findSite: (id: string) => SiteConfig | null,
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
  const site = findSite(id)
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
