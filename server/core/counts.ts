// The counters: one row per site, UTC day, event and prop value, holding how often it happened.
import type { DatabaseSync } from 'node:sqlite'
import {
  REFUSALS,
  type EventReport,
  type Refusal,
  type SiteConfig,
  type SiteReport,
} from '../../shared/contracts'
import { transaction } from '#nexitas/server/core/database'

const DAY = 24 * 60 * 60 * 1000

/** The UTC day of a moment, as YYYY-MM-DD. */
export const dayOf = (now: number) => new Date(now).toISOString().slice(0, 10)

/** The first day of a range of `days` ending today. */
const since = (days: number, now: number) => dayOf(now - (days - 1) * DAY)

/** Counts one event: its total, and each prop value it carried. */
export function countEvent(
  db: DatabaseSync,
  site: string,
  event: string,
  props: Record<string, string>,
  now = Date.now(),
) {
  const day = dayOf(now)
  const add = db.prepare(
    `INSERT INTO counts (site, day, event, prop, value, count) VALUES (?, ?, ?, ?, ?, 1)
    ON CONFLICT DO UPDATE SET count = count + 1`,
  )
  transaction(db, () => {
    add.run(site, day, event, '', '')
    for (const [prop, value] of Object.entries(props)) add.run(site, day, event, prop, value)
  })
}

/** Counts one beacon a configured site sent and its settings refused, by its reason only. */
export function countRefusal(db: DatabaseSync, site: string, reason: Refusal, now = Date.now()) {
  db.prepare(
    `INSERT INTO refusals (site, day, reason, count) VALUES (?, ?, ?, 1)
    ON CONFLICT DO UPDATE SET count = count + 1`,
  ).run(site, dayOf(now), reason)
}

/** Forgets every refusal a site has counted, once the owner has dealt with them: only ones that
 *  come after show again. */
export function clearRefusals(db: DatabaseSync, site: string) {
  return Number(db.prepare('DELETE FROM refusals WHERE site = ?').run(site).changes)
}

/** A site's refusals since `day`: how many by reason, and the last day there were any. */
function refusalsSince(db: DatabaseSync, site: string, day: string) {
  const rows = db
    .prepare('SELECT day, reason, count FROM refusals WHERE site = ? AND day >= ?')
    .all(site, day) as { day: string; reason: Refusal; count: number }[]
  const reasons = Object.fromEntries(REFUSALS.map((reason) => [reason, 0])) as Record<
    Refusal,
    number
  >
  let latest: string | null = null
  for (const row of rows) {
    reasons[row.reason] += row.count
    if (!latest || row.day > latest) latest = row.day
  }
  return { total: rows.reduce((sum, row) => sum + row.count, 0), reasons, latest }
}

/** Every event a site counted today. */
export function countToday(db: DatabaseSync, site: string, now = Date.now()) {
  return (
    db
      .prepare(
        "SELECT coalesce(sum(count), 0) AS count FROM counts WHERE prop = '' AND day = ? AND site = ?",
      )
      .get(dayOf(now), site) as { count: number }
  ).count
}

/** Every event a site counted over the last `days` days, today included. */
export function countDays(db: DatabaseSync, site: string, days: number, now = Date.now()) {
  return (
    db
      .prepare(
        "SELECT coalesce(sum(count), 0) AS count FROM counts WHERE prop = '' AND day >= ? AND site = ?",
      )
      .get(dayOf(now - (days - 1) * 24 * 60 * 60 * 1000), site) as { count: number }
  ).count
}

/** One site over the last `days` days: daily counts per event, the breakdown by prop value, and
 *  each event's total over the `days` before, to compare with. Configured events come first in
 *  their order, then any counted since dropped from the config. */
export function siteReport(
  db: DatabaseSync,
  site: SiteConfig,
  days: number,
  now = Date.now(),
): SiteReport {
  const rows = db
    .prepare(`SELECT day, event, prop, value, count FROM counts WHERE site = ? AND day >= ?`)
    .all(site.id, since(2 * days, now)) as {
    day: string
    event: string
    prop: string
    value: string
    count: number
  }[]
  const events = new Map<string, EventReport>()
  const report = (name: string) => {
    let entry = events.get(name)
    if (!entry) {
      const rules = site.events[name] ?? {}
      entry = {
        name,
        total: 0,
        previous: 0,
        daily: {},
        props: Object.entries(rules).map(([key, values]) => ({
          key,
          values: values.map((value) => ({ value, count: 0 })),
        })),
      }
      events.set(name, entry)
    }
    return entry
  }
  for (const name of Object.keys(site.events)) report(name)
  const start = since(days, now)
  for (const row of rows) {
    const entry = report(row.event)
    if (row.day < start) {
      if (!row.prop) entry.previous += row.count
      continue
    }
    if (!row.prop) {
      entry.total += row.count
      entry.daily[row.day] = (entry.daily[row.day] ?? 0) + row.count
      continue
    }
    let prop = entry.props.find((candidate) => candidate.key === row.prop)
    if (!prop) entry.props.push((prop = { key: row.prop, values: [] }))
    const value = prop.values.find((candidate) => candidate.value === row.value)
    if (value) value.count += row.count
    else prop.values.push({ value: row.value, count: row.count })
  }
  for (const entry of events.values())
    for (const prop of entry.props) prop.values.sort((a, b) => b.count - a.count)
  return {
    id: site.id,
    origins: site.origins,
    refused: refusalsSince(db, site.id, start),
    days: Array.from({ length: days }, (_, i) => dayOf(now - i * DAY)),
    events: [...events.values()],
  }
}
