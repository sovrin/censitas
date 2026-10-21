// censitas as a nexitas module: its schema, the beacon route sites call, and what it says about a
// project. The owner's sign-in, the /api guard and the database itself are the core's.
import type { NexitasModule } from '#nexitas/shared/modules'
import { plural } from '#nexitas/app/lib/format'
import { countToday } from './counts'
import { getProjectSite, removeSite } from './sites'

export const censitas: NexitasModule = {
  id: 'censitas',
  migrations: [
    // Only counters: no row says who, when within the day, or from where. An event's own total
    // has prop and value ''; each prop it carried adds one to its value's row. Each site counts
    // for a project of nexitas, which holds its origins for every module. Beacons a site sent but
    // its settings refused are counted by a fixed reason only: what was sent is never kept, so a
    // misconfiguration shows without storing anyone's text.
    `CREATE TABLE sites (
      id TEXT PRIMARY KEY, project_id TEXT NOT NULL UNIQUE REFERENCES projects(id),
      events TEXT NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
    );
    CREATE TABLE counts (
      site TEXT NOT NULL, day TEXT NOT NULL, event TEXT NOT NULL, prop TEXT NOT NULL,
      value TEXT NOT NULL, count INTEGER NOT NULL,
      PRIMARY KEY (site, day, event, prop, value)
    ) WITHOUT ROWID;
    CREATE TABLE refusals (
      site TEXT NOT NULL, day TEXT NOT NULL,
      reason TEXT NOT NULL CHECK (reason IN ('origin', 'event', 'prop', 'value')),
      count INTEGER NOT NULL,
      PRIMARY KEY (site, day, reason)
    ) WITHOUT ROWID;`,
  ],
  // A beacon is well under 1 kB. Nobody reads its answer, so a refusal is JSON for whoever debugs
  // a site in its network panel, never the sign-in page.
  publicRoutes: [{ path: '/v1/e', maxBody: 4 * 1024, json: true }],
  // Everything censitas serves; switched off, all of it answers 404 and no beacon is counted.
  paths: ['/sites', '/api/sites'],
  // The counters' heartbeat: is anything arriving today?
  projectStatus: (db, projectId) => {
    const site = getProjectSite(db, projectId)
    if (!site) return []
    const today = countToday(db, site.id)
    const to = `/p/${projectId}/sites`
    return [
      today
        ? { text: `${plural(today, 'event')} today`, to, tone: 'success' }
        : { text: 'nothing yet today', to },
    ]
  },
  deleteProject: (db, projectId) => {
    const site = getProjectSite(db, projectId)
    if (site) removeSite(db, site.id)
  },
}
