<script setup lang="ts">
import type { ProjectSummary } from '#nexitas/shared/contracts'
import type { ProjectUsage } from '../../../shared/contracts'
import { errorMessage, plural } from '#nexitas/app/lib/format'
import { trackerSnippet } from '../../lib/embed'

/** censitas' part of a project's page: whether it counts, today's figure, and its tracker. */
const props = defineProps<{ project: ProjectSummary }>()
const { data, error, refresh } = await useProjectFetch<ProjectUsage>('/sites')
const origin = useRequestURL().origin

async function start() {
  // The tracker counts a page view on import, so a site starts with that event alone.
  await $fetch(`/api/p/${props.project.id}/sites`, {
    method: 'POST',
    body: { events: { pageview: {} } },
  })
  await refresh()
}
</script>

<template>
  <!-- Under the module's name and icon, which the project page puts above it. -->
  <div class="stack gap-3">
    <AppAlert v-if="error" title="Could not load its usage.">{{ errorMessage(error) }}</AppAlert>
    <template v-else-if="data?.site">
      <p class="cluster gap-4">
        <span class="tabular">{{
          data.today ? `${plural(data.today, 'event')} today` : 'nothing yet today'
        }}</span>
        <NuxtLink :to="`/p/${project.id}/sites`" class="link">Dashboard</NuxtLink>
        <NuxtLink :to="`/p/${project.id}/sites/settings`" class="link">Events</NuxtLink>
      </p>
      <EmbedCode :code="trackerSnippet(origin, data.site.id)" />
      <small class="text-muted"
        >Importing it counts a page view; call
        <code class="font-mono">track('export-start', { resolution: '1080p' })</code> for the rest,
        once its settings list them.</small
      >
    </template>
    <PanelStart
      v-else-if="data"
      label="Count usage"
      failed="Could not start counting."
      :start="start"
    >
      Counts what happens on its pages, never who: no cookie, no identifier, no consent banner.
    </PanelStart>
  </div>
</template>
