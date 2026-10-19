import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

// aequitas is not published yet: it is consumed from the built dist/ of a sibling checkout
// (../aequitas next to this repository). Run `pnpm build` there first, or point AEQUITAS_DIST
// at another dist/ directory (the Dockerfile does, from a Compose build context).
const root = dirname(fileURLToPath(import.meta.url))
const aequitas = resolve(root, process.env.AEQUITAS_DIST ?? '../aequitas/dist') + '/'

export default defineNuxtConfig({
  compatibilityDate: '2026-09-06',
  devtools: { enabled: false },
  css: [`${aequitas}aequitas.css`, `${aequitas}aequitas.icons.css`, '~/assets/app.css'],
  alias: { '@aequitas': aequitas },
  vite: { server: { fs: { allow: [root, resolve(aequitas, '..')] } } },
  nitro: { preset: 'node-server' },
  // Page changes crossfade through the browser's View Transitions (see app.css for timing).
  experimental: { viewTransition: true },
  routeRules: {
    // The tracker is loaded by other sites as a module script, which browsers fetch with CORS.
    // It is public code; a short cache lets a fix reach every site within minutes.
    '/v1/track.js': {
      headers: { 'access-control-allow-origin': '*', 'cache-control': 'public, max-age=300' },
    },
  },
  app: {
    head: {
      // data-ae-manual: importing aequitas.js (setTheme) must not run its DOM-scanning init.
      // Graphite keeps the accent neutral, so colour on screen only ever reports state.
      htmlAttrs: {
        lang: 'en',
        'data-ae-manual': '',
        'data-accent': 'graphite',
        'data-density': 'compact',
      },
      title: 'censitas',
      meta: [{ name: 'description', content: 'What happens on your sites, counted, not who.' }],
      link: [{ rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' }],
    },
  },
})
