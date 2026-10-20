import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { DatabaseSync } from 'node:sqlite'
import { afterEach, describe, expect, it } from 'vitest'
import { siteConfigSchema, sitesFileSchema, type SiteConfig } from '../../shared/contracts'
import {
  clearRefusals,
  countEvent,
  countRefusal,
  countToday,
  siteReport,
  siteSummaries,
} from '../../server/core/counts'
import { openDatabase } from '#nexitas/server/core/database'
import { createProject, deleteProject, getProject } from '#nexitas/server/core/projects'
import { isBot } from '../../server/core/limits'
import { censitas } from '../../server/core/module'
import {
  acceptBeacon,
  createSite,
  deleteCounts,
  deleteSite,
  getSite,
  importSites,
  listSites,
  SiteConflict,
  updateSite,
} from '../../server/core/sites'

const DAY = 24 * 60 * 60 * 1000
const NOW = Date.UTC(2026, 9, 19, 12)
const dirs: string[] = []
const dbs: DatabaseSync[] = []

function database(modules = [censitas]) {
  const dir = mkdtempSync(join(tmpdir(), 'censitas-test-'))
  dirs.push(dir)
  const db = openDatabase(join(dir, 'censitas.sqlite'), modules)
  dbs.push(db)
  return db
}

afterEach(() => {
  for (const db of dbs.splice(0)) if (db.isOpen) db.close()
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})

const sonotas: SiteConfig = siteConfigSchema.parse({
  id: 'sonotas',
  origins: ['https://sonotas.example.com/'],
  events: {
    pageview: {},
    load: { source: ['demo', 'file'], format: ['gp', 'gpx'] },
  },
})
const ORIGIN = 'https://sonotas.example.com'
/** sonotas as a project of nexitas, counted by censitas. */
function addSonotas(db: DatabaseSync) {
  createProject(db, { id: 'sonotas', name: 'sonotas', origins: sonotas.origins })
  return createSite(db, 'sonotas', sonotas.events)
}
const stored = (site: typeof sonotas) => ({ ...site, projectId: site.id })
const findSite = (id: string) => (id === sonotas.id ? sonotas : null)
const beacon = (body: object, origin: string | undefined = ORIGIN) =>
  acceptBeacon(findSite, origin, JSON.stringify(body))

describe('site settings', () => {
  it('refuse origins with a path, bad names, free-text values and repeats', () => {
    const site = (events: object, origins = [ORIGIN]) =>
      siteConfigSchema.safeParse({ id: 'sonotas', origins, events }).success
    expect(site({ pageview: {} })).toBe(true)
    expect(site({ pageview: {} }, ['https://sonotas.example.com/app'])).toBe(false)
    expect(site({ pageview: {} }, [])).toBe(false)
    expect(site({})).toBe(false)
    expect(site({ PageView: {} })).toBe(false)
    expect(site({ load: { source: ['a file name.gp'] } })).toBe(false)
    expect(site({ load: { source: [] } })).toBe(false)
    expect(site({ load: { source: ['demo', 'demo'] } })).toBe(false)
    expect(siteConfigSchema.safeParse({ ...sonotas, id: 'Sonotas' }).success).toBe(false)
  })

  it('are stored, listed, changed, and deleted with their counts', () => {
    const db = database()
    expect(addSonotas(db)).toBe(true)
    expect(createSite(db, 'sonotas', sonotas.events)).toBe(false)
    expect(getSite(db, 'sonotas')).toEqual(stored(sonotas))
    const changed = { ...sonotas, events: { pageview: {}, 'link-copy': {} } }
    expect(updateSite(db, 'sonotas', changed.events)).toBe(true)
    expect(listSites(db)).toEqual([stored(changed)])
    countEvent(db, 'sonotas', 'pageview', {}, NOW)
    countEvent(db, 'other', 'pageview', {}, NOW)
    expect(deleteSite(db, 'sonotas')).toBe(true)
    expect(getSite(db, 'sonotas')).toBeNull()
    expect(db.prepare('SELECT site FROM counts').all()).toEqual([{ site: 'other' }])
  })

  it('take their origins from the project, and go when it does', () => {
    const db = database()
    addSonotas(db)
    expect(censitas.projectStatus!(db, 'sonotas')).toEqual([
      { text: 'nothing yet today', to: '/sites/sonotas' },
    ])
    expect(censitas.projectStatus!(db, 'other')).toEqual([])
    countEvent(db, 'sonotas', 'pageview', {})
    deleteProject(db, 'sonotas', [censitas])
    expect(getSite(db, 'sonotas')).toBeNull()
    expect(db.prepare('SELECT site FROM counts').all()).toEqual([])
  })
})

describe('deleting counts', () => {
  it("clears a site's counts and refusals, keeping the site and other sites' data", () => {
    const db = database()
    addSonotas(db)
    countEvent(db, 'sonotas', 'load', { source: 'demo' }, NOW)
    countRefusal(db, 'sonotas', 'value', NOW)
    countEvent(db, 'other', 'pageview', {}, NOW)
    expect(deleteCounts(db, 'sonotas')).toBe(3)
    expect(getSite(db, 'sonotas')).toEqual(stored(sonotas))
    expect(siteReport(db, sonotas, 7, NOW).events.every((event) => !event.total)).toBe(true)
    expect(siteReport(db, sonotas, 7, NOW).refused.total).toBe(0)
    expect(db.prepare('SELECT site FROM counts').all()).toEqual([{ site: 'other' }])
  })
})

describe('sites files', () => {
  it('import new sites and replace existing settings, keeping counts', () => {
    const db = database()
    addSonotas(db)
    countEvent(db, 'sonotas', 'pageview', {}, NOW)
    const changed = {
      ...sonotas,
      origins: ['https://www.sonotas.example.com'],
      events: { pageview: {}, 'link-copy': {} },
    }
    const other = { ...sonotas, id: 'other' }
    expect(importSites(db, [changed, other])).toEqual({ added: ['other'], replaced: ['sonotas'] })
    expect(listSites(db)).toEqual([stored(other), stored(changed)])
    // The file's origins are the project's now, for every module; its name stays.
    expect(getProject(db, 'sonotas')).toEqual({
      id: 'sonotas',
      name: 'sonotas',
      origins: changed.origins,
    })
    expect(countToday(db, NOW)).toBe(1)
  })

  it('import nothing when a project counts under another site already', () => {
    const db = database()
    addSonotas(db)
    db.prepare("UPDATE sites SET id = 'sonotas-web'").run()
    expect(() => importSites(db, [{ ...sonotas, id: 'other' }, sonotas])).toThrow(SiteConflict)
    expect(listSites(db).map((site) => site.id)).toEqual(['sonotas-web'])
    expect(getProject(db, 'other')).toBeNull()
  })

  it('are refused without the marker, empty or with a site twice', () => {
    const file = (sites: unknown, censitas: unknown = 1) =>
      sitesFileSchema.safeParse({ censitas, sites }).success
    expect(file([sonotas])).toBe(true)
    expect(file([sonotas], 2)).toBe(false)
    expect(file([])).toBe(false)
    expect(file([sonotas, sonotas])).toBe(false)
  })

  it('include a valid example for sonotas', () => {
    const example = JSON.parse(
      readFileSync(join(import.meta.dirname, '../../examples/sonotas.json'), 'utf8'),
    )
    expect(sitesFileSchema.safeParse(example).success).toBe(true)
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
    expect(beacon({ site: 'sonotas', event: 'pageview' }, 'https://evil.example')).toMatchObject({
      status: 403,
    })
    // without an Origin header (a default parameter would swallow undefined)
    expect(
      acceptBeacon(findSite, undefined, JSON.stringify({ site: 'sonotas', event: 'pageview' })),
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
    expect(acceptBeacon(findSite, ORIGIN, 'not json')).toMatchObject({ status: 400 })
    expect(beacon({ site: 'sonotas', event: 'pageview', extra: 1 })).toMatchObject({ status: 400 })
    expect(beacon({ site: 'sonotas', event: 'load', props: { source: 1 } })).toMatchObject({
      status: 400,
    })
    expect(beacon({ site: 'sonotas', event: 'x'.repeat(65) })).toMatchObject({ status: 400 })
  })
})

describe('refusals', () => {
  it('name a fixed reason for a configured site, and none for an unknown one', () => {
    const reason = (body: object, origin?: string) =>
      (beacon(body, origin) as { refusal?: { reason: string } }).refusal?.reason
    expect(reason({ site: 'sonotas', event: 'pageview' }, 'https://evil.example')).toBe('origin')
    expect(reason({ site: 'sonotas', event: 'signup' })).toBe('event')
    expect(reason({ site: 'sonotas', event: 'load', props: { file: 'demo' } })).toBe('prop')
    expect(reason({ site: 'sonotas', event: 'load', props: { source: 'url' } })).toBe('value')
    expect(beacon({ site: 'other', event: 'pageview' })).not.toHaveProperty('refusal')
    expect(acceptBeacon(findSite, ORIGIN, 'not json')).not.toHaveProperty('refusal')
  })

  it('are counted per day and reason, reported over the range, and go with their site', () => {
    const db = database()
    addSonotas(db)
    countRefusal(db, 'sonotas', 'value', NOW)
    countRefusal(db, 'sonotas', 'value', NOW - DAY)
    countRefusal(db, 'sonotas', 'event', NOW - 2 * DAY)
    countRefusal(db, 'sonotas', 'origin', NOW - 40 * DAY)
    expect(siteReport(db, sonotas, 7, NOW).refused).toEqual({
      total: 3,
      reasons: { origin: 0, event: 1, prop: 0, value: 2 },
      latest: '2026-10-19',
    })
    deleteSite(db, 'sonotas')
    expect(db.prepare('SELECT * FROM refusals').all()).toEqual([])
  })

  it('are forgotten when cleared, and only later ones show', () => {
    const db = database()
    countRefusal(db, 'sonotas', 'value', NOW - DAY)
    countRefusal(db, 'other', 'value', NOW - DAY)
    expect(clearRefusals(db, 'sonotas')).toBe(1)
    expect(siteReport(db, sonotas, 7, NOW).refused.total).toBe(0)
    countRefusal(db, 'sonotas', 'event', NOW)
    expect(siteReport(db, sonotas, 7, NOW).refused).toMatchObject({
      total: 1,
      latest: '2026-10-19',
    })
    expect(db.prepare("SELECT count(*) AS n FROM refusals WHERE site = 'other'").get()).toEqual({
      n: 1,
    })
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
    countEvent(db, 'sonotas', 'pageview', {}, NOW - 40 * DAY)
    const [summary] = siteSummaries(db, [sonotas], NOW)
    expect(summary).toMatchObject({
      id: 'sonotas',
      origins: [ORIGIN],
      events: 4,
      pageviews: 1,
      previousPageviews: 1,
    })
    expect(summary!.trend).toHaveLength(30)
    expect(summary!.trend.at(-1)).toBe(1)
  })

  it('report a range per day and by prop value, configured values at 0', () => {
    const db = database()
    countEvent(db, 'sonotas', 'load', { source: 'file' }, NOW)
    countEvent(db, 'sonotas', 'load', { source: 'file' }, NOW - DAY)
    countEvent(db, 'sonotas', 'load', { source: 'demo' }, NOW - 7 * DAY)
    const report = siteReport(db, sonotas, 7, NOW)
    expect(report.days).toHaveLength(7)
    expect(report.days[0]).toBe('2026-10-19')
    expect(report.events.map((event) => event.name)).toEqual(['pageview', 'load'])
    expect(report.origins).toEqual([ORIGIN])
    expect(report.events[1]).toEqual({
      name: 'load',
      total: 2,
      // the demo load a week ago falls in the 7 days before
      previous: 1,
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
