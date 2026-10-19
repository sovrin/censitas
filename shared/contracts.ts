// Every rule about what censitas accepts lives here, shared by the dashboard and the server.
import { z } from 'zod'

/** Scheme, host and port only, as a browser sends it in the Origin header. */
export function isOrigin(value: string) {
  try {
    const url = new URL(value)
    return ['http:', 'https:'].includes(url.protocol) && url.origin === value
  } catch {
    return false
  }
}

export const ownerCredentialsSchema = z
  .object({
    email: z
      .email()
      .max(254)
      .transform((value) => value.toLowerCase()),
    password: z.string().min(12, 'Use at least 12 characters.').max(256),
  })
  .strict()

export const setupSchema = ownerCredentialsSchema.extend({ token: z.string().min(32).max(256) })

export interface AuthStatus {
  setupRequired: boolean
  owner: { email: string } | null
}

const NAME = /^[a-z][a-z0-9-]{0,39}$/
const PROP = /^[a-z][a-zA-Z0-9]{0,31}$/
// A value is a word from a short list the site owner wrote down, never free text from a page.
const VALUE = /^[\w.:+-]{1,40}$/

export const siteIdSchema = z.string().regex(NAME, 'Use lowercase letters, digits and dashes.')

/** A record whose keys must match `pattern`. A bad key is reported at its own path with
 *  `message`; zod's own key check only says the record has an invalid key. */
function keyed<T extends z.ZodType>(pattern: RegExp, message: string, value: T) {
  return z.record(z.string(), value).superRefine((record, context) => {
    for (const key of Object.keys(record))
      if (!pattern.test(key)) context.addIssue({ code: 'custom', path: [key], message })
  })
}

/** One event a site may send: each prop it may carry, with the values it may take. */
export const eventRulesSchema = keyed(
  PROP,
  'Start a prop with a letter; letters and digits only.',
  z
    .array(z.string().regex(VALUE, 'Use letters, digits and . : + - _ in a value.'))
    .min(1, 'List at least one value.')
    .max(50)
    .refine((values) => new Set(values).size === values.length, 'Each value once.'),
).refine((props) => Object.keys(props).length <= 10, 'At most 10 props.')
export type EventRules = z.infer<typeof eventRulesSchema>

/** A site and everything it may send. Only what is listed here is counted. */
export const siteConfigSchema = z
  .object({
    id: siteIdSchema,
    origins: z
      .array(
        z
          .string()
          .trim()
          .transform((value) => value.replace(/\/$/, ''))
          .refine(isOrigin, 'Enter an origin like https://sonotas.example.com, without a path.'),
      )
      .min(1, 'Add the site that sends.')
      .max(10),
    events: keyed(NAME, 'Use lowercase letters, digits and dashes.', eventRulesSchema)
      .refine((events) => Object.keys(events).length >= 1, 'List at least one event.')
      .refine((events) => Object.keys(events).length <= 50, 'At most 50 events.'),
  })
  .strict()
export type SiteConfig = z.infer<typeof siteConfigSchema>

/** A file of sites, as the dashboard exports and imports them: settings only, never counts. */
export const sitesFileSchema = z
  .object({
    censitas: z.literal(1, 'This is not a censitas sites file.'),
    sites: z
      .array(siteConfigSchema)
      .min(1, 'The file holds no sites.')
      .max(100)
      .refine(
        (sites) => new Set(sites.map((site) => site.id)).size === sites.length,
        'Each site once.',
      ),
  })
  .strict()
export type SitesFile = z.infer<typeof sitesFileSchema>

/** What track.js sends. Names, props and values are checked against the site afterwards. */
export const beaconSchema = z
  .object({
    site: z.string().max(40),
    event: z.string().max(40),
    props: z.record(z.string().max(32), z.string().max(40)).optional(),
  })
  .strict()
export type Beacon = z.infer<typeof beaconSchema>

/** Why a configured site's beacon was refused. Fixed words only: what was sent is never kept. */
export const REFUSALS = ['origin', 'event', 'prop', 'value'] as const
export type Refusal = (typeof REFUSALS)[number]

/** The ranges the dashboard offers, in days. */
export const RANGES = [7, 30, 90] as const

export interface SiteSummary {
  id: string
  origins: string[]
  /** Every event counted in the last 30 days. */
  events: number
  /** Of those, page views. */
  pageviews: number
  /** Page views in the 30 days before, to compare with. */
  previousPageviews: number
  /** Page views per day over the last 30 days, oldest first. */
  trend: number[]
}

export interface EventReport {
  name: string
  total: number
  /** The total of the period of the same length just before, to compare with. */
  previous: number
  /** Counts per UTC day (YYYY-MM-DD); days without any are left out. */
  daily: Record<string, number>
  /** Each prop with every value it was counted with, the configured ones included at 0. */
  props: { key: string; values: { value: string; count: number }[] }[]
}

export interface SiteReport {
  id: string
  origins: string[]
  /** Beacons the site sent in the range that its settings refused, by reason, and the last day
   *  one was. */
  refused: { total: number; reasons: Record<Refusal, number>; latest: string | null }
  /** Every day of the range, newest first. */
  days: string[]
  events: EventReport[]
}
