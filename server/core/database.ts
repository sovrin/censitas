import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { DatabaseSync } from 'node:sqlite'

const VERSION = 4

export function openDatabase(dataDir: string) {
  mkdirSync(dataDir, { recursive: true, mode: 0o700 })
  const db = new DatabaseSync(resolve(dataDir, 'censitas.sqlite'))
  db.exec('PRAGMA busy_timeout = 5000; PRAGMA journal_mode = WAL;')
  transaction(db, () => {
    const { user_version: version } = db.prepare('PRAGMA user_version').get() as {
      user_version: number
    }
    if (version > VERSION) throw new Error('This database requires a newer version of censitas.')
    // Only counters: no row says who, when within the day, or from where. An event's own total
    // has prop and value ''; each prop it carried adds one to its value's row.
    if (version === 0)
      db.exec(`
      CREATE TABLE counts (
        site TEXT NOT NULL, day TEXT NOT NULL, event TEXT NOT NULL, prop TEXT NOT NULL,
        value TEXT NOT NULL, count INTEGER NOT NULL,
        PRIMARY KEY (site, day, event, prop, value)
      ) WITHOUT ROWID;
      PRAGMA user_version = 1;
    `)
    // Sites are configured in the dashboard, no longer in a file.
    if (version < 2)
      db.exec(`
      CREATE TABLE sites (
        id TEXT PRIMARY KEY, origins TEXT NOT NULL, events TEXT NOT NULL,
        created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
      );
      PRAGMA user_version = 2;
    `)
    // Beacons a configured site sent but its settings refused, counted by a fixed reason only:
    // what was sent is never kept, so a misconfiguration shows without storing anyone's text.
    if (version < 3)
      db.exec(`
      CREATE TABLE refusals (
        site TEXT NOT NULL, day TEXT NOT NULL,
        reason TEXT NOT NULL CHECK (reason IN ('origin', 'event', 'prop', 'value')),
        count INTEGER NOT NULL,
        PRIMARY KEY (site, day, reason)
      ) WITHOUT ROWID;
      PRAGMA user_version = 3;
    `)
    // The dashboard signs in an owner account, as collatas does, instead of the HTTP basic auth it used before.
    if (version < 4)
      db.exec(`
      CREATE TABLE owner (id INTEGER PRIMARY KEY CHECK (id = 1), email TEXT NOT NULL, password_hash TEXT NOT NULL);
      CREATE TABLE sessions (token_hash TEXT PRIMARY KEY, expires_at INTEGER NOT NULL);
      PRAGMA user_version = 4;
    `)
  })
  return db
}

export function transaction<T>(db: DatabaseSync, run: () => T): T {
  db.exec('BEGIN IMMEDIATE')
  try {
    const result = run()
    db.exec('COMMIT')
    return result
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }
}
