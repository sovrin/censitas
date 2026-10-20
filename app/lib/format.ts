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

/** 60, 1.2K, 3M: an axis tick. */
export const formatCompact = (value: number) =>
  new Intl.NumberFormat('en-GB', { notation: 'compact' }).format(value)

/** The change from `previous` to `current` as aequitas' .delta shows it: the sign in the text,
 *  the trend for its colour. Nothing to compare when there was nothing before. */
export function formatDelta(current: number, previous: number) {
  if (!previous) return null
  const change = Math.round(((current - previous) / previous) * 100)
  return {
    text: change > 0 ? `+${change}%` : change < 0 ? `−${-change}%` : '±0%',
    trend: change > 0 ? 'up' : change < 0 ? 'down' : 'flat',
  }
}
