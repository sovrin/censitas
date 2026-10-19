import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { DatabaseSync } from 'node:sqlite'
import { afterEach, describe, expect, it } from 'vitest'
import { sitesSchema, type Sites } from '../../shared/contracts'
import { countEvent, countToday, siteReport, siteSummaries } from '../../server/core/counts'
import { openDatabase } from '../../server/core/database'
import { createLimiter, isBot, senderNetwork } from '../../server/core/limits'
import { acceptBeacon } from '../../server/core/sites'

const DAY = 24 * 60 * 60 * 1000
const NOW = Date.UTC(2026, 9, 19, 12)
const dirs: string[] = []
const dbs: DatabaseSync[] = []

function database() {
  const dir = mkdtempSync(join(tmpdir(), 'censitas-test-'))
  dirs.push(dir)
  const db = openDatabase(dir)
  dbs.push(db)
  return db
}

afterEach(() => {
  for (const db of dbs.splice(0)) db.close()
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})

const sites: Sites = sitesSchema.parse({
  sonotas: {
    origins: ['https://sonotas.example.com/'],
    events: {
      pageview: {},
      load: { source: ['demo', 'file'], format: ['gp', 'gpx'] },
    },
  },
})
const ORIGIN = 'https://sonotas.example.com'
const beacon = (body: object, origin: string | undefined = ORIGIN) =>
  acceptBeacon(sites, origin, JSON.stringify(body))

describe('sites file', () => {
  it('refuses origins with a path, bad names and free-text values', () => {
    const site = (events: object, origins = [ORIGIN]) =>
      sitesSchema.safeParse({ sonotas: { origins, events } }).success
    expect(site({ pageview: {} })).toBe(true)
    expect(site({ pageview: {} }, ['https://sonotas.example.com/app'])).toBe(false)
    expect(site({ PageView: {} })).toBe(false)
    expect(site({ load: { source: ['a file name.gp'] } })).toBe(false)
    expect(site({ load: { source: [] } })).toBe(false)
    expect(sitesSchema.safeParse({ Sonotas: { origins: [ORIGIN], events: {} } }).success).toBe(
      false,
    )
  })
})

describe('beacons', () => {
  it('pass with a configured site, origin, event, props and values', () => {
    expect(beacon({ site: 'sonotas', event: 'pageview' })).toEqual({
      site: 'sonotas',
      event: 'pageview',
      props: {},
    })
    expect(beacon({ site: 'sonotas', event: 'load', props: { source: 'demo' } })).toEqual({
      site: 'sonotas',
      event: 'load',
      props: { source: 'demo' },
    })
  })

  it('are refused for another site or origin', () => {
    expect(beacon({ site: 'other', event: 'pageview' })).toMatchObject({ status: 403 })
    expect(beacon({ site: 'constructor', event: 'pageview' })).toMatchObject({ status: 403 })
    expect(beacon({ site: 'sonotas', event: 'pageview' }, 'https://evil.example')).toMatchObject({
      status: 403,
    })
    // without an Origin header (a default parameter would swallow undefined)
    expect(
      acceptBeacon(sites, undefined, JSON.stringify({ site: 'sonotas', event: 'pageview' })),
    ).toMatchObject({ status: 403 })
    expect(beacon({ site: 'sonotas', event: 'pageview' }, 'null')).toMatchObject({ status: 403 })
  })

  it('are refused for an event, prop or value the site does not list', () => {
    expect(beacon({ site: 'sonotas', event: 'signup' })).toMatchObject({ status: 400 })
    expect(beacon({ site: 'sonotas', event: 'toString' })).toMatchObject({ status: 400 })
    expect(beacon({ site: 'sonotas', event: 'load', props: { file: 'demo' } })).toMatchObject({
      status: 400,
    })
    expect(beacon({ site: 'sonotas', event: 'pageview', props: { source: 'demo' } })).toMatchObject(
      { status: 400 },
    )
    expect(
      beacon({ site: 'sonotas', event: 'load', props: { source: 'my-song.gp' } }),
    ).toMatchObject({ status: 400 })
  })

  it('are refused when they are not the expected JSON or too long', () => {
    expect(acceptBeacon(sites, ORIGIN, 'not json')).toMatchObject({ status: 400 })
    expect(beacon({ site: 'sonotas', event: 'pageview', extra: 1 })).toMatchObject({ status: 400 })
    expect(beacon({ site: 'sonotas', event: 'load', props: { source: 1 } })).toMatchObject({
      status: 400,
    })
    expect(beacon({ site: 'sonotas', event: 'x'.repeat(41) })).toMatchObject({ status: 400 })
  })
})

describe('counters', () => {
  it('add one per event and per prop value, per UTC day', () => {
    const db = database()
    countEvent(db, 'sonotas', 'load', { source: 'demo', format: 'gp' }, NOW)
    countEvent(db, 'sonotas', 'load', { source: 'demo' }, NOW)
    countEvent(db, 'sonotas', 'load', { source: 'file' }, NOW - DAY)
    countEvent(db, 'sonotas', 'pageview', {}, NOW)
    expect(db.prepare('SELECT * FROM counts ORDER BY day, event, prop, value').all()).toEqual([
      { site: 'sonotas', day: '2026-10-18', event: 'load', prop: '', value: '', count: 1 },
      {
        site: 'sonotas',
        day: '2026-10-18',
        event: 'load',
        prop: 'source',
        value: 'file',
        count: 1,
      },
      { site: 'sonotas', day: '2026-10-19', event: 'load', prop: '', value: '', count: 2 },
      { site: 'sonotas', day: '2026-10-19', event: 'load', prop: 'format', value: 'gp', count: 1 },
      {
        site: 'sonotas',
        day: '2026-10-19',
        event: 'load',
        prop: 'source',
        value: 'demo',
        count: 2,
      },
      { site: 'sonotas', day: '2026-10-19', event: 'pageview', prop: '', value: '', count: 1 },
    ])
    expect(countToday(db, NOW)).toBe(3)
    expect(siteSummaries(db, sites, NOW)).toEqual([
      { id: 'sonotas', origins: [ORIGIN], events: 4, pageviews: 1 },
    ])
  })

  it('report a range per day and by prop value, configured values at 0', () => {
    const db = database()
    countEvent(db, 'sonotas', 'load', { source: 'file' }, NOW)
    countEvent(db, 'sonotas', 'load', { source: 'file' }, NOW - DAY)
    countEvent(db, 'sonotas', 'load', { source: 'demo' }, NOW - 7 * DAY)
    const report = siteReport(db, 'sonotas', sites.sonotas!, 7, NOW)
    expect(report.days).toHaveLength(7)
    expect(report.days[0]).toBe('2026-10-19')
    expect(report.events.map((event) => event.name)).toEqual(['pageview', 'load'])
    expect(report.events[1]).toEqual({
      name: 'load',
      total: 2,
      daily: { '2026-10-19': 1, '2026-10-18': 1 },
      props: [
        {
          key: 'source',
          values: [
            { value: 'file', count: 2 },
            { value: 'demo', count: 0 },
          ],
        },
        {
          key: 'format',
          values: [
            { value: 'gp', count: 0 },
            { value: 'gpx', count: 0 },
          ],
        },
      ],
    })
  })
})

describe('limits', () => {
  it('allow a set number of hits per window, then forget everyone', () => {
    const limit = createLimiter(3, 60_000)
    for (let i = 0; i < 3; i++) expect(limit.hit('a', 1000)).toBe(true)
    expect(limit.allows('a', 2000)).toBe(false)
    expect(limit.hit('a', 2000)).toBe(false)
    expect(limit.hit('b', 2000)).toBe(true)
    expect(limit.allows('a', 61_000)).toBe(true)
    expect(limit.hit('a', 61_000)).toBe(true)
  })

  it('count an IPv6 sender by its /64, and IPv4 as it is', () => {
    expect(senderNetwork('2001:db8:1:2:a:b:c:d')).toBe('2001:db8:1:2::/64')
    expect(senderNetwork('2001:db8:1:2::5')).toBe('2001:db8:1:2::/64')
    expect(senderNetwork('2001:DB8::5')).toBe('2001:db8:0:0::/64')
    expect(senderNetwork('fe80::1%eth0')).toBe('fe80:0:0:0::/64')
    expect(senderNetwork('203.0.113.7')).toBe('203.0.113.7')
    expect(senderNetwork('::ffff:203.0.113.7')).toBe('203.0.113.7')
  })

  it('tell bots from browsers', () => {
    expect(isBot(undefined)).toBe(true)
    expect(isBot('')).toBe(true)
    expect(isBot('Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)')).toBe(
      true,
    )
    expect(isBot('curl/8.7.1')).toBe(true)
    expect(isBot('Mozilla/5.0 (X11; Linux x86_64) HeadlessChrome/120.0.0.0 Safari/537.36')).toBe(
      true,
    )
    expect(
      isBot(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15',
      ),
    ).toBe(false)
  })
})
