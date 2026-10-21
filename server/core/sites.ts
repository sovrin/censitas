// The sites censitas counts for, one per project, and what each one may send. Who may send is the
// project's: its origins, which every module of the project shares.
import type { DatabaseSync } from 'node:sqlite'
import { beaconSchema, type Refusal, type Site, type SiteConfig } from '../../shared/contracts'
import { transaction } from '#nexitas/server/core/database'

interface SiteRow {
  id: string
  project_id: string
  origins: string
  events: string
}

const toSite = (row: SiteRow): Site => ({
  id: row.id,
  projectId: row.project_id,
  origins: JSON.parse(row.origins),
  events: JSON.parse(row.events),
})

const SELECT = `SELECT sites.id, sites.project_id, sites.events, coalesce(projects.origins, '[]') AS origins
  FROM sites LEFT JOIN projects ON projects.id = sites.project_id`

export function getSite(db: DatabaseSync, id: string): Site | null {
  const row = db.prepare(`${SELECT} WHERE sites.id = ?`).get(id) as SiteRow | undefined
  return row ? toSite(row) : null
}

export function getProjectSite(db: DatabaseSync, projectId: string): Site | null {
  const row = db.prepare(`${SELECT} WHERE sites.project_id = ?`).get(projectId) as
    | SiteRow
    | undefined
  return row ? toSite(row) : null
}

/** Starts counting for a project, under its id. False when it counts already, or a site has the
 *  id. */
export function createSite(
  db: DatabaseSync,
  projectId: string,
  events: SiteConfig['events'],
  now = Date.now(),
) {
  return (
    db
      .prepare(
        `INSERT OR IGNORE INTO sites (id, project_id, events, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?)`,
      )
      .run(projectId, projectId, JSON.stringify(events), now, now).changes === 1
  )
}

/** The id never changes: the tracker in the site's pages names it. */
export function updateSite(
  db: DatabaseSync,
  id: string,
  events: SiteConfig['events'],
  now = Date.now(),
) {
  return (
    db
      .prepare('UPDATE sites SET events = ?, updated_at = ? WHERE id = ?')
      .run(JSON.stringify(events), now, id).changes === 1
  )
}
/** Deletes every count and refusal a site has, keeping the site: it counts again from zero.
 *  Returns how many rows went. */
export function deleteCounts(db: DatabaseSync, id: string) {
  return transaction(
    db,
    () =>
      Number(db.prepare('DELETE FROM counts WHERE site = ?').run(id).changes) +
      Number(db.prepare('DELETE FROM refusals WHERE site = ?').run(id).changes),
  )
}

/** Deletes the site and every count it has. */
export function deleteSite(db: DatabaseSync, id: string) {
  return transaction(db, () => removeSite(db, id))
}

/** deleteSite for a caller inside a transaction already, as the core's when a project goes. */
export function removeSite(db: DatabaseSync, id: string) {
  db.prepare('DELETE FROM counts WHERE site = ?').run(id)
  db.prepare('DELETE FROM refusals WHERE site = ?').run(id)
  return db.prepare('DELETE FROM sites WHERE id = ?').run(id).changes === 1
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
  // The origins are its project's, read with the site.
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
