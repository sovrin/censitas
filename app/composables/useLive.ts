// The dashboard is live through one server-sent event stream per tab (/api/events). Every view that
// shows data subscribes with its refresh: it runs when the server announces a change, and once
// after the connection comes back, as a change may have been missed while it was down.
type Refresh = () => unknown

const subscribers = new Set<Refresh>()
let source: EventSource | undefined
let pending: ReturnType<typeof setTimeout> | undefined

// Several changes in a burst (a busy site, an import) cause one refresh.
function refreshAll() {
  clearTimeout(pending)
  pending = setTimeout(() => {
    for (const refresh of subscribers) refresh()
  }, 150)
}

function connect() {
  const stream = new EventSource('/api/events')
  let opened = false
  stream.addEventListener('change', refreshAll)
  // EventSource reconnects by itself; every open after the first is a reconnect.
  stream.addEventListener('open', () => {
    if (opened) refreshAll()
    opened = true
  })
  source = stream
}

export function useLive(refresh: Refresh) {
  onMounted(() => {
    subscribers.add(refresh)
    // A refused stream (signed out, say) is closed for good; a new subscriber tries again.
    if (!source || source.readyState === EventSource.CLOSED) connect()
  })
  onUnmounted(() => {
    subscribers.delete(refresh)
    if (subscribers.size) return
    source?.close()
    source = undefined
  })
}
