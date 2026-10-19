// The counters: one row per site, UTC day, event and prop value, holding how often it happened.
import type { DatabaseSync } from 'node:sqlite'
import type { EventReport, SiteConfig, SiteReport, SiteSummary } from '../../shared/contracts'
import { transaction } from './database'

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

/** Every configured site with what it counted in the last 30 days. */
export function siteSummaries(
  db: DatabaseSync,
  sites: Record<string, SiteConfig>,
  now = Date.now(),
): SiteSummary[] {
  const totals = db.prepare(
    `SELECT coalesce(sum(count), 0) AS events, coalesce(sum(count) FILTER (WHERE event = 'pageview'), 0) AS pageviews
    FROM counts WHERE site = ? AND prop = '' AND day >= ?`,
  )
  return Object.entries(sites).map(([id, site]) => ({
    id,
    origins: site.origins,
    ...(totals.get(id, since(30, now)) as { events: number; pageviews: number }),
  }))
}

/** Every event counted today, across sites. */
export function countToday(db: DatabaseSync, now = Date.now()) {
  return (
    db
      .prepare("SELECT coalesce(sum(count), 0) AS count FROM counts WHERE prop = '' AND day = ?")
      .get(dayOf(now)) as { count: number }
  ).count
}

/** One site over the last `days` days: daily counts per event and the breakdown by prop value.
 *  Configured events come first in their order, then any counted since dropped from the config. */
export function siteReport(
  db: DatabaseSync,
  id: string,
  site: SiteConfig,
  days: number,
  now = Date.now(),
): SiteReport {
  const rows = db
    .prepare(`SELECT day, event, prop, value, count FROM counts WHERE site = ? AND day >= ?`)
    .all(id, since(days, now)) as {
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
  for (const row of rows) {
    const entry = report(row.event)
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
    id,
    days: Array.from({ length: days }, (_, i) => dayOf(now - i * DAY)),
    events: [...events.values()],
  }
}
