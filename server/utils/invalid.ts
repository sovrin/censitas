import type { z } from 'zod'

/** A 400 listing each problem by field, for the form to show beside it. */
export function invalid(error: z.ZodError) {
  return createError({
    statusCode: 400,
    statusMessage: 'Check these settings.',
    data: {
      issues: error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message })),
    },
  })
}
