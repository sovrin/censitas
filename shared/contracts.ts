// Every rule about what censitas accepts lives here, shared by the dashboard and the server. The
// owner's sign-in and what an origin is are nexitas' rules.
import { z } from 'zod'
import { originsSchema } from '#nexitas/shared/contracts'

const NAME = /^[a-z][a-z0-9-]{0,63}$/
const PROP = /^[a-z][a-zA-Z0-9]{0,31}$/
// A value is a word from a short list the site owner wrote down, never free text from a page.
const VALUE = /^[\w.:+-]{1,64}$/

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
    .max(64)
    .refine((values) => new Set(values).size === values.length, 'Each value once.'),
).refine((props) => Object.keys(props).length <= 16, 'At most 16 props.')
export type EventRules = z.infer<typeof eventRulesSchema>

/** Every event a site may send. Only what is listed here is counted. */
export const siteEventsSchema = keyed(
  NAME,
  'Use lowercase letters, digits and dashes.',
  eventRulesSchema,
)
  .refine((events) => Object.keys(events).length >= 1, 'List at least one event.')
  .refine((events) => Object.keys(events).length <= 64, 'At most 64 events.')

/** What can change about a site: its events. Who may send is its project's origins. */
export const siteSettingsSchema = z.object({ events: siteEventsSchema }).strict()

/** Counting for a project: its site takes the project's id, which the tracker then names. */
export const newSiteSchema = siteSettingsSchema.extend({ projectId: z.string().max(64) }).strict()

/** A site as a sites file holds it: with the origins of its project, so a file stays complete. */
export const siteConfigSchema = z
  .object({
    id: siteIdSchema,
    origins: originsSchema,
    events: siteEventsSchema,
  })
  .strict()
export type SiteConfig = z.infer<typeof siteConfigSchema>

/** A site as stored: its settings, the project it counts for, and that project's origins. */
export interface Site extends SiteConfig {
  projectId: string
}

/** A file of sites, as the dashboard exports and imports them: settings only, never counts. */
export const sitesFileSchema = z
  .object({
    censitas: z.literal(1, 'This is not a censitas sites file.'),
    sites: z
      .array(siteConfigSchema)
      .min(1, 'The file holds no sites.')
      .max(128)
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
    site: z.string().max(64),
    event: z.string().max(64),
    props: z.record(z.string().max(32), z.string().max(64)).optional(),
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

/** A project's usage, for its panel: its site, if it counts, and today's events. */
export interface ProjectUsage {
  site: Site | null
  today: number
}
