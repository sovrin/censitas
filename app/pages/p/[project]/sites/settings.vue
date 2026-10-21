<script setup lang="ts">
import type { ProjectUsage } from '../../../../../shared/contracts'
import { errorMessage } from '#nexitas/app/lib/format'
import { trackerSnippet } from '../../../../lib/embed'

const project = useProject().id.value
const { data, error, refresh } = await useFetch<ProjectUsage>(`/api/p/${project}/sites`)
const site = computed(() => data.value?.site)
useHead({ title: `${project} settings · ${useRuntimeConfig().public.nexitas.name}` })

const savedNotice = ref(false)
async function saved() {
  await refresh()
  savedNotice.value = true
}

const origin = useRequestURL().origin

// Two things can go, each behind typing the project's id: its counts alone, or the whole site.
type Removal = 'counts' | 'site'
const removal = ref<Removal>('counts')
const deleteOpen = ref(false)
const typed = ref('')
const deleteError = ref('')
const countsDeleted = ref(false)
const REMOVALS = {
  counts: {
    title: `Delete everything ${project} counted?`,
    description:
      'To start over, after testing for example: its counts and refusals go; its settings and the tracker in it stay, and it counts again from zero. This cannot be undone.',
    confirm: 'Delete counts',
  },
  site: {
    title: `Delete ${project} and its counts?`,
    description:
      'It goes with all its counts, and the tracker in it is refused from then on. The project stays; it just stops counting. This cannot be undone.',
    confirm: 'Delete site',
  },
} as const
function ask(next: Removal) {
  removal.value = next
  typed.value = ''
  deleteError.value = ''
  countsDeleted.value = false
  deleteOpen.value = true
}
async function remove() {
  try {
    if (removal.value === 'site') {
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
  <div class="stack gap-5">
    <nav aria-label="Breadcrumb">
      <ol class="breadcrumb">
        <li><NuxtLink :to="`/p/${project}/sites`">Usage</NuxtLink></li>
        <li aria-current="page">Settings</li>
      </ol>
    </nav>

    <div v-if="error" class="alert" data-tone="danger" role="alert">
      <div><strong>Could not load this site.</strong> {{ errorMessage(error) }}</div>
    </div>
    <template v-else-if="site">
      <div class="page-header">
        <h1 class="text-xl weight-600 font-mono">{{ project }}</h1>
        <div class="cluster gap-2">
          <button
            type="button"
            class="btn"
            data-size="s"
            data-variant="ghost"
            data-tone="danger"
            @click="ask('counts')"
          >
            Delete counts
          </button>
          <button
            type="button"
            class="btn"
            data-size="s"
            data-variant="ghost"
            data-tone="danger"
            @click="ask('site')"
          >
            Delete site
          </button>
        </div>
      </div>
      <div v-if="countsDeleted" class="alert" data-tone="success" role="status">
        <div>
          <strong>Counts deleted.</strong> <span class="font-mono">{{ project }}</span> counts again
          from zero.
        </div>
      </div>
      <div v-if="deleteError" class="alert" data-tone="danger" role="alert">
        <div>
          <strong>{{
            removal === 'site' ? 'Could not delete the site.' : 'Could not delete the counts.'
          }}</strong>
          {{ deleteError }}
        </div>
      </div>

      <!-- What the site may send takes the room; the tracker that sends it sits beside it. -->
      <div class="with-aside">
        <section class="stack gap-3 min-w-0" aria-labelledby="events-title">
          <h2 id="events-title" class="text-s weight-600 hairline-b pb-2">Events</h2>
          <div v-if="savedNotice" class="alert" data-tone="success" role="status">
            <div><strong>Saved.</strong> The next event the site sends is checked against it.</div>
          </div>
          <SiteForm :key="JSON.stringify(site)" :site="site" @saved="saved" />
        </section>

        <aside class="stack gap-3" aria-labelledby="embed-title">
          <h2 id="embed-title" class="text-s weight-600 hairline-b pb-2">Tracker</h2>
          <EmbedCode :code="trackerSnippet(origin, site.id)" caption="JavaScript" />
          <small class="text-muted text-s"
            >Importing it counts a page view; call
            <code class="font-mono">track('export-start', { resolution: '1080p' })</code> for the
            rest. Until it has loaded, or if it never does, track() does nothing.</small
          >
        </aside>
      </div>
    </template>
    <p v-else-if="data" class="text-muted">
      This project doesn't count its usage.
      <NuxtLink :to="`/p/${project}`" class="link">Count usage</NuxtLink> on its page to start.
    </p>

    <ConfirmDialog
      v-model:open="deleteOpen"
      :title="REMOVALS[removal].title"
      :confirm-label="REMOVALS[removal].confirm"
      tone="danger"
      :disabled="typed !== project"
      @confirm="remove"
    >
      <template #description>{{ REMOVALS[removal].description }}</template>
      <div class="field">
        <label for="confirm-id"
          >Type <span class="font-mono">{{ project }}</span> to confirm</label
        >
        <input id="confirm-id" v-model="typed" class="input font-mono text-s" autocomplete="off" />
      </div>
    </ConfirmDialog>
  </div>
</template>
