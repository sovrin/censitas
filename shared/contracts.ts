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

const NAME = /^[a-z][a-z0-9-]{0,39}$/
const PROP = /^[a-z][a-zA-Z0-9]{0,31}$/
// A value is a word from a short list the site owner wrote down, never free text from a page.
const VALUE = /^[\w.:+-]{1,40}$/

export const siteIdSchema = z.string().regex(NAME, 'Use lowercase letters, digits and dashes.')

/** One event a site may send: each prop it may carry, with the values it may take. */
export const eventRulesSchema = z.record(
  z.string().regex(PROP, 'Start a prop with a letter; letters and digits only.'),
  z.array(z.string().regex(VALUE, 'Use letters, digits and . : + - _ in a value.')).min(1).max(50),
)
export type EventRules = z.infer<typeof eventRulesSchema>

export const siteConfigSchema = z
  .object({
    origins: z
      .array(
        z
          .string()
          .transform((value) => value.replace(/\/$/, ''))
          .refine(isOrigin, 'Enter an origin like https://sonotas.example.com, without a path.'),
      )
      .min(1)
      .max(10),
    events: z.record(
      z.string().regex(NAME, 'Use lowercase letters, digits and dashes.'),
      eventRulesSchema,
    ),
  })
  .strict()
export type SiteConfig = z.infer<typeof siteConfigSchema>

/** The sites file: every site by its id. */
export const sitesSchema = z.record(siteIdSchema, siteConfigSchema)
export type Sites = z.infer<typeof sitesSchema>

/** What track.js sends. Names, props and values are checked against the site afterwards. */
export const beaconSchema = z
  .object({
    site: z.string().max(40),
    event: z.string().max(40),
    props: z.record(z.string().max(32), z.string().max(40)).optional(),
  })
  .strict()
export type Beacon = z.infer<typeof beaconSchema>

/** The ranges the dashboard offers, in days. */
export const RANGES = [7, 30, 90] as const

export interface SiteSummary {
  id: string
  origins: string[]
  /** Every event counted in the last 30 days. */
  events: number
  /** Of those, page views. */
  pageviews: number
}

export interface EventReport {
  name: string
  total: number
  /** Counts per UTC day (YYYY-MM-DD); days without any are left out. */
  daily: Record<string, number>
  /** Each prop with every value it was counted with, the configured ones included at 0. */
  props: { key: string; values: { value: string; count: number }[] }[]
}

export interface SiteReport {
  id: string
  /** Every day of the range, newest first. */
  days: string[]
  events: EventReport[]
}
