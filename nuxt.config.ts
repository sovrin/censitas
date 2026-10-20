import { execFileSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

// censitas is a module of nexitas: a Nuxt layer that nexitas extends, as its modules.json lists
// it. The owner's sign-in, the /api guard, live updates, the database, projects and
// the page shell are nexitas'; this layer adds the counters, their pages and the tracker.
// Everything here resolves from this folder, since the app around it is nexitas.
const root = dirname(fileURLToPath(import.meta.url))

export default defineNuxtConfig({
  compatibilityDate: '2026-09-06',
  css: [resolve(root, 'app/assets/app.css')],
  // nexitas allows its own files and aequitas'; these are censitas' own.
  vite: { server: { fs: { allow: [root] } } },
  // The tracker is bundled on its own (public/v1/track.js): built with every build of nexitas
  // that includes censitas, from wherever it runs.
  hooks: {
    'build:before': () => {
      execFileSync('pnpm', ['build:widget'], { cwd: root, stdio: 'inherit' })
    },
  },
  routeRules: {
    // The tracker is loaded by other sites as a module script, which browsers fetch with CORS.
    // It is public code; a short cache lets a fix reach every site within minutes.
    '/v1/track.js': {
      headers: { 'access-control-allow-origin': '*', 'cache-control': 'public, max-age=300' },
    },
  },
})
