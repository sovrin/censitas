<script setup lang="ts">
import { formatCount } from '~/lib/format'
// The counters' heartbeat on every page: is anything arriving today?
const { data, refresh } = useFetch<{ today: number; siteCount: number }>('/api/summary', {
  key: 'status-line',
  server: false,
  lazy: true,
})
// Refresh on navigation, so the line never contradicts the page that just loaded.
const route = useRoute()
watch(
  () => route.fullPath,
  () => refresh(),
)
</script>
<template>
  <!-- One small mono line under the page. It truncates rather than wraps. -->
  <p class="cluster gap-2 flex-nowrap font-mono text-xs text-muted" aria-label="Counter status">
    <span class="dot" :data-tone="data?.today ? 'success' : undefined" aria-hidden="true"></span>
    <span class="flex-1 min-w-0 truncate" role="status">
      <template v-if="data">
        {{ data.today ? `${formatCount(data.today)} events today` : 'nothing yet today' }}
        ·
        <NuxtLink to="/" class="link" data-quiet
          >{{ data.siteCount }} {{ data.siteCount === 1 ? 'site' : 'sites' }}</NuxtLink
        >
      </template>
      <template v-else>counters loading</template>
    </span>
  </p>
</template>
