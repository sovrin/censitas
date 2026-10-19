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

/** Every site with what it counted in the last 30 days, the 30 before, and page views per day. */
export function siteSummaries(
  db: DatabaseSync,
  sites: SiteConfig[],
  now = Date.now(),
): SiteSummary[] {
  const totals = db.prepare(
    `SELECT coalesce(sum(count) FILTER (WHERE day >= $since), 0) AS events,
      coalesce(sum(count) FILTER (WHERE day >= $since AND event = 'pageview'), 0) AS pageviews,
      coalesce(sum(count) FILTER (WHERE day < $since AND event = 'pageview'), 0) AS previousPageviews
    FROM counts WHERE site = $site AND prop = '' AND day >= $before`,
  )
  const daily = db.prepare(
    `SELECT day, count FROM counts
    WHERE site = ? AND event = 'pageview' AND prop = '' AND day >= ?`,
  )
  const days = Array.from({ length: 30 }, (_, i) => dayOf(now - (29 - i) * DAY))
  return sites.map((site) => {
    const counts = new Map(
      (daily.all(site.id, days[0]!) as { day: string; count: number }[]).map((row) => [
        row.day,
        row.count,
      ]),
    )
    return {
      id: site.id,
      origins: site.origins,
      ...(totals.get({ site: site.id, since: since(30, now), before: since(60, now) }) as {
        events: number
        pageviews: number
        previousPageviews: number
      }),
      trend: days.map((day) => counts.get(day) ?? 0),
    }
  })
}

/** Every event counted today, across sites. */
export function countToday(db: DatabaseSync, now = Date.now()) {
  return (
    db
      .prepare("SELECT coalesce(sum(count), 0) AS count FROM counts WHERE prop = '' AND day = ?")
      .get(dayOf(now)) as { count: number }
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
    days: Array.from({ length: days }, (_, i) => dayOf(now - i * DAY)),
    events: [...events.values()],
  }
}
