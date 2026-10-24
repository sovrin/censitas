<script setup lang="ts">
import type { ProjectSummary } from '#nexitas/shared/contracts'
import type { ProjectUsage } from '../../../shared/contracts'
import { errorMessage } from '#nexitas/app/lib/format'
// Imported by path: a layer's new components are not always found by name in development.
import TrackerCode from '../TrackerCode.vue'

/** censitas' part of a project's page: only its setup, the tracker and where its settings are.
 *  What it counted is the sidebar's and the Usage page's to say. */
const props = defineProps<{ project: ProjectSummary }>()
const { data, error, refresh } = await useProjectFetch<ProjectUsage>('/sites')

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
      <TrackerCode :site="data.site.id" />
      <p>
        <NuxtLink :to="`/p/${project.id}/sites/settings`" class="link">Settings</NuxtLink>
      </p>
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
