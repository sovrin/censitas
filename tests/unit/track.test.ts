import { resolve } from 'node:path'
import { runInNewContext } from 'node:vm'
import { buildSync } from 'esbuild'
import { describe, expect, it } from 'vitest'

// track.js as sites get it, with the address it was imported from filled in, run in a context
// that holds only what it is given and notes every other global it reaches for.
const SCRIPT = 'https://censitas.example.com/v1/track.js?site=sonotas'
const source = buildSync({
  entryPoints: [resolve(import.meta.dirname, '../../widget/censitas-track.ts')],
  bundle: true,
  write: false,
  format: 'iife',
  globalName: 'censitas',
  define: { 'import.meta.url': JSON.stringify(SCRIPT) },
}).outputFiles[0]!.text

function run() {
  const beacons: { url: string; body: unknown }[] = []
  const reached: string[] = []
  const navigator = new Proxy(
    {
      sendBeacon: (url: string, body: unknown) => {
        beacons.push({ url, body })
        return true
      },
    },
    {
      get(target, name) {
        if (name !== 'sendBeacon') reached.push(`navigator.${String(name)}`)
        return Reflect.get(target, name)
      },
    },
  )
  const context: Record<string, unknown> = { navigator, URL, JSON }
  const watched = [
    'document',
    'localStorage',
    'sessionStorage',
    'indexedDB',
    'caches',
    'crypto',
    'screen',
    'location',
    'history',
    'fetch',
    'XMLHttpRequest',
    'WebSocket',
  ]
  for (const name of watched)
    Object.defineProperty(context, name, {
      get: () => {
        reached.push(name)
        return undefined
      },
    })
  const { track } = runInNewContext(`${source}; censitas`, context) as {
    track: (event: string, props?: Record<string, string>) => void
  }
  return { track, beacons, reached }
}

describe('track.js', () => {
  it('sends a page view on import, and each event, to the censitas it came from', () => {
    const { track, beacons } = run()
    track('load', { source: 'demo' })
    expect(beacons).toEqual([
      { url: 'https://censitas.example.com/v1/e', body: '{"site":"sonotas","event":"pageview"}' },
      {
        url: 'https://censitas.example.com/v1/e',
        body: '{"site":"sonotas","event":"load","props":{"source":"demo"}}',
      },
    ])
  })

  it('touches no storage, cookie or other browser state, and makes no identifier', () => {
    const { track, reached } = run()
    track('load', { source: 'demo' })
    expect(reached).toEqual([])
    expect(source).not.toMatch(
      /cookie|localStorage|sessionStorage|indexedDB|caches|crypto|random|Date|userAgent|screen/,
    )
  })
})
