import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { DatabaseSync } from 'node:sqlite'

const VERSION = 1

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
