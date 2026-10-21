<script setup lang="ts">
import type { ProjectSummary } from '#nexitas/shared/contracts'
import type { ProjectUsage } from '../../../shared/contracts'
import { errorMessage } from '#nexitas/app/lib/format'
import { formatCount } from '../../lib/format'
import { trackerSnippet } from '../../lib/embed'

/** censitas' part of a project's page: whether it counts, today's figure, and its tracker. */
const props = defineProps<{ project: ProjectSummary }>()
const { data, error, refresh } = await useFetch<ProjectUsage>(`/api/p/${props.project.id}/sites`)
useLive(refresh)
const origin = useRequestURL().origin

const pending = ref(false)
const startError = ref('')
async function start() {
  pending.value = true
  startError.value = ''
  try {
    // The tracker counts a page view on import, so a site starts with that event alone.
    await $fetch(`/api/p/${props.project.id}/sites`, {
      method: 'POST',
      body: { events: { pageview: {} } },
    })
    await refresh()
  } catch (cause) {
    startError.value = errorMessage(cause)
  } finally {
    pending.value = false
  }
}
</script>

<template>
  <!-- Under the module's name and icon, which the project page puts above it. -->
  <div class="stack gap-3">
    <div v-if="error" class="alert" data-tone="danger" role="alert">
      <div><strong>Could not load its usage.</strong> {{ errorMessage(error) }}</div>
    </div>
    <template v-else-if="data?.site">
      <p class="cluster gap-4">
        <span class="tabular">{{
          data.today ? `${formatCount(data.today)} events today` : 'nothing yet today'
        }}</span>
        <NuxtLink :to="`/p/${project.id}/sites`" class="link">Dashboard</NuxtLink>
        <NuxtLink :to="`/p/${project.id}/sites/settings`" class="link">Events</NuxtLink>
      </p>
      <EmbedCode :code="trackerSnippet(origin, data.site.id)" caption="JavaScript" />
      <small class="text-muted text-s"
        >Importing it counts a page view; call
        <code class="font-mono">track('export-start', { resolution: '1080p' })</code> for the rest,
        once its settings list them.</small
      >
    </template>
    <template v-else-if="data">
      <p class="text-s text-muted">
        Counts what happens on its pages, never who: no cookie, no identifier, no consent banner.
      </p>
      <p>
        <button
          type="button"
          class="btn"
          data-size="s"
          :disabled="pending"
          :aria-busy="pending || undefined"
          @click="start"
        >
          Count usage
        </button>
      </p>
      <div v-if="startError" class="alert" data-tone="danger" role="alert">
        <div><strong>Could not start counting.</strong> {{ startError }}</div>
      </div>
    </template>
  </div>
</template>
