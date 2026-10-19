import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { DatabaseSync } from 'node:sqlite'
import { afterEach, describe, expect, it } from 'vitest'
import { ownerCredentialsSchema, setupSchema } from '../../shared/contracts'
import {
  authenticate,
  createOwner,
  createSession,
  getOwner,
  hashPassword,
  resetOwner,
  revokeSession,
  sessionOwner,
  tokensMatch,
  verifyPassword,
} from '../../server/core/auth'
import { openDatabase } from '../../server/core/database'

const DAY = 24 * 60 * 60 * 1000
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

describe('owner', () => {
  it('signs in with the email and password it was created with, once', async () => {
    const db = database()
    expect(getOwner(db)).toBeNull()
    const hash = await hashPassword('a long passphrase')
    expect(await verifyPassword('a long passphrase', hash)).toBe(true)
    expect(await verifyPassword('another phrase', hash)).toBe(false)
    expect(createOwner(db, 'me@example.com', hash)).toBe(true)
    expect(createOwner(db, 'other@example.com', hash)).toBe(false)
    expect(await authenticate(db, 'me@example.com', 'a long passphrase')).toBe(true)
    expect(await authenticate(db, 'other@example.com', 'a long passphrase')).toBe(false)
    expect(await authenticate(db, 'me@example.com', 'wrong passphrase')).toBe(false)
  })

  it('keeps sessions as hashes for a week, until revoked or reset', async () => {
    const db = database()
    createOwner(db, 'me@example.com', await hashPassword('a long passphrase'))
    const { token } = createSession(db, 0)
    expect(sessionOwner(db, token, DAY)).toEqual({ email: 'me@example.com' })
    expect(sessionOwner(db, token, 8 * DAY)).toBeNull()
    expect(db.prepare('SELECT token_hash FROM sessions').get()).not.toEqual({ token_hash: token })
    const second = createSession(db).token
    revokeSession(db, second)
    expect(sessionOwner(db, second)).toBeNull()
    const third = createSession(db).token
    resetOwner(db)
    expect(sessionOwner(db, third)).toBeNull()
    expect(getOwner(db)).toBeNull()
  })

  it('checks the installation key and the credentials it is set up with', () => {
    expect(tokensMatch('k'.repeat(32), 'k'.repeat(32))).toBe(true)
    expect(tokensMatch('k'.repeat(32), 'x'.repeat(32))).toBe(false)
    expect(
      ownerCredentialsSchema.parse({ email: 'Me@Example.com', password: 'x'.repeat(12) }).email,
    ).toBe('me@example.com')
    expect(
      ownerCredentialsSchema.safeParse({ email: 'me@example.com', password: 'short' }).success,
    ).toBe(false)
    expect(
      setupSchema.safeParse({ email: 'me@example.com', password: 'x'.repeat(12), token: 'short' })
        .success,
    ).toBe(false)
  })
})
