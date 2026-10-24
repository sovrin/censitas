<script setup lang="ts">
import type { ProjectUsage } from '../../../../../shared/contracts'
import NotCounting from '../../../../components/NotCounting.vue'
import TrackerCode from '../../../../components/TrackerCode.vue'

const project = useProject().id.value
const { data, error, refresh } = await useProjectFetch<ProjectUsage>('/sites')
const site = computed(() => data.value?.site)

const savedNotice = ref(false)
async function saved() {
  await refresh()
  savedNotice.value = true
}

// Two things can go, each behind typing the project's id: its counts alone, or the whole site.
type Removal = 'counts' | 'site'
const removal = ref<Removal>('counts')
const { pending: removing, error: removeError, submit } = useSubmit()
const countsDeleted = ref(false)
async function remove(next: Removal) {
  removal.value = next
  countsDeleted.value = false
  await submit(async () => {
    if (next === 'site') {
      await $fetch(`/api/p/${project}/sites/delete`, { method: 'POST', body: {} })
      // The project stays, with its other modules; it just no longer counts.
      await navigateTo(`/p/${project}`)
      return
    }
    await $fetch(`/api/p/${project}/sites/counts/delete`, { method: 'POST', body: {} })
    countsDeleted.value = true
  })
}
</script>

<template>
  <AppPage
    title="Settings"
    failed="Could not load the usage."
    :error="error"
    :aside-title="site ? 'Tracker' : undefined"
  >
    <!-- What the site may send takes the room; the tracker that sends it sits beside it. -->
    <template v-if="site">
      <AppAlert v-if="countsDeleted" tone="success" title="Counts deleted."
        ><span class="font-mono">{{ project }}</span> counts again from zero.</AppAlert
      >
      <AppSection title="Events">
        <AppAlert v-if="savedNotice" tone="success" title="Saved." />
        <SiteForm :key="JSON.stringify(site)" :site="site" @saved="saved" />
      </AppSection>
    </template>
    <NotCounting v-else-if="data" />

    <template v-if="site" #aside>
      <TrackerCode :site="site.id" />
    </template>
    <template v-if="site" #danger>
      <span>Its counts, or its counts and settings; the project stays.</span>
      <DangerAction
        label="Delete counts"
        :title="`Delete everything ${project} counted?`"
        :confirm-word="project"
        :pending="removing"
        @confirm="remove('counts')"
      >
        To start over, after testing for example: its refusals go too; its settings and the tracker
        stay, and it counts again from zero. This cannot be undone.
      </DangerAction>
      <DangerAction
        label="Stop counting"
        :title="`Stop counting ${project}?`"
        :confirm-word="project"
        :pending="removing"
        @confirm="remove('site')"
      >
        The tracker in its pages is refused from then on. Counting again later starts from zero.
        This cannot be undone.
      </DangerAction>
      <AppAlert
        v-if="removeError"
        :title="removal === 'site' ? 'Could not stop counting.' : 'Could not delete the counts.'"
        >{{ removeError }}</AppAlert
      >
    </template>
  </AppPage>
</template>
