<script setup lang="ts">
import type { ProjectUsage } from '../../../../../shared/contracts'
import { errorMessage } from '#nexitas/app/lib/format'
import { trackerSnippet } from '../../../../lib/embed'

const project = useProject().id.value
const { data, error, refresh } = await useProjectFetch<ProjectUsage>('/sites')
const site = computed(() => data.value?.site)

const savedNotice = ref(false)
async function saved() {
  await refresh()
  savedNotice.value = true
}

const origin = useRequestURL().origin

// Two things can go, each behind typing the project's id: its counts alone, or the whole site.
type Removal = 'counts' | 'site'
const removal = ref<Removal>('counts')
const deleteError = ref('')
const countsDeleted = ref(false)
async function remove(next: Removal) {
  removal.value = next
  deleteError.value = ''
  countsDeleted.value = false
  try {
    if (next === 'site') {
      await $fetch(`/api/p/${project}/sites/delete`, { method: 'POST', body: {} })
      // The project stays, with its other modules; it just no longer counts.
      await navigateTo(`/p/${project}`)
      return
    }
    await $fetch(`/api/p/${project}/sites/counts/delete`, { method: 'POST', body: {} })
    countsDeleted.value = true
  } catch (cause) {
    deleteError.value = errorMessage(cause)
  }
}
</script>

<template>
  <AppPage title="Settings" failed="Could not load this site." :error="error">
    <template v-if="site" #actions>
      <DangerAction
        label="Delete counts"
        :title="`Delete everything ${project} counted?`"
        :confirm-word="project"
        @confirm="remove('counts')"
      >
        To start over, after testing for example: its counts and refusals go; its settings and the
        tracker in it stay, and it counts again from zero. This cannot be undone.
      </DangerAction>
      <DangerAction
        label="Delete site"
        :title="`Delete ${project} and its counts?`"
        :confirm-word="project"
        @confirm="remove('site')"
      >
        It goes with all its counts, and the tracker in it is refused from then on. The project
        stays; it just stops counting. This cannot be undone.
      </DangerAction>
    </template>

    <!-- What the site may send takes the room; the tracker that sends it sits beside it. -->
    <template v-if="site">
      <AppAlert v-if="countsDeleted" tone="success" title="Counts deleted."
        ><span class="font-mono">{{ project }}</span> counts again from zero.</AppAlert
      >
      <AppAlert
        v-if="deleteError"
        :title="removal === 'site' ? 'Could not delete the site.' : 'Could not delete the counts.'"
        >{{ deleteError }}</AppAlert
      >
      <AppSection title="Events">
        <AppAlert v-if="savedNotice" tone="success" title="Saved."
          >The next event the site sends is checked against it.</AppAlert
        >
        <SiteForm :key="JSON.stringify(site)" :site="site" @saved="saved" />
      </AppSection>
    </template>
    <p v-else-if="data" class="text-muted">
      This project doesn't count its usage.
      <NuxtLink :to="`/p/${project}`" class="link">Count usage</NuxtLink> on its page to start.
    </p>

    <template v-if="site" #aside>
      <AppSection title="Tracker">
        <EmbedCode :code="trackerSnippet(origin, site.id)" />
        <small class="text-muted text-s"
          >Importing it counts a page view; call
          <code class="font-mono">track('export-start', { resolution: '1080p' })</code> for the
          rest. Until it has loaded, or if it never does, track() does nothing.</small
        >
      </AppSection>
    </template>
  </AppPage>
</template>
