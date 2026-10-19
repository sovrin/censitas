/** "19 Oct", or "Sun 19 Oct" with the weekday: a UTC day as a row shows it. */
export function formatDay(day: string, weekday = false) {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    ...(weekday ? { weekday: 'short' } : {}),
    timeZone: 'UTC',
  }).format(new Date(`${day}T00:00:00Z`))
}

export const formatCount = (value: number) => new Intl.NumberFormat('en-GB').format(value)

export function errorMessage(error: unknown) {
  const response = error as { data?: { statusMessage?: string } }
  return response?.data?.statusMessage || 'Could not reach censitas. Please try again.'
}

/** 60, 1.2K, 3M: an axis tick. */
export const formatCompact = (value: number) =>
  new Intl.NumberFormat('en-GB', { notation: 'compact' }).format(value)
