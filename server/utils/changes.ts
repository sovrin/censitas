// Who is watching: one callback per open dashboard tab (see api/events.get.ts). Kept in memory,
// which holds because censitas runs as a single process.
type Listener = () => void

const listeners = new Set<Listener>()
// A busy site sends beacons all the time; open dashboards hear about them at most this often.
const BEACON_PACE = 3000
let pending: ReturnType<typeof setTimeout> | undefined

/** Hear about every change; returns how to stop. */
export function onChange(listener: Listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** Something the dashboard shows has changed: tell every open tab to look again. */
export function announceChange() {
  for (const listener of listeners) listener()
}

/** A beacon was counted or refused: announce it within BEACON_PACE, together with any others
 *  that arrive meanwhile, so dashboards refresh at a steady pace however busy the sites are. */
export function announceBeacon() {
  if (pending || !listeners.size) return
  pending = setTimeout(() => {
    pending = undefined
    announceChange()
  }, BEACON_PACE)
}
