<script setup lang="ts">
import type { Site } from '../../../../shared/contracts'
import { errorMessage } from '#nexitas/app/lib/format'
import { trackerSnippet } from '../../../lib/embed'

const route = useRoute()
const id = route.params.id as string
const { data: site, error, refresh } = await useFetch<Site>(`/api/sites/${id}`)
useHead({ title: `${id} settings · ${useRuntimeConfig().public.nexitas.name}` })

const savedNotice = ref(false)
async function saved() {
  await refresh()
  savedNotice.value = true
}

const embed = trackerSnippet(useRequestURL().origin, id)

// Two things can go, each behind typing the site's id: its counts alone, or the whole site.
type Removal = 'counts' | 'site'
const removal = ref<Removal>('counts')
const deleteOpen = ref(false)
const typed = ref('')
const deleteError = ref('')
const countsDeleted = ref(false)
const REMOVALS = {
  counts: {
    title: `Delete everything ${id} counted?`,
    description:
      'Its counts and refusals go; its settings and the tracker in it stay, and it counts again from zero. This cannot be undone.',
    confirm: 'Delete counts',
  },
  site: {
    title: `Delete ${id} and its counts?`,
    description:
      'The project stays; it just stops counting, and the tracker in it is refused. This cannot be undone.',
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
      await $fetch(`/api/sites/${id}/delete`, { method: 'POST', body: {} })
      // The project stays, with its other modules; it just no longer counts.
      await navigateTo(`/projects/${site.value?.projectId ?? ''}`)
      return
    }
    await $fetch(`/api/sites/${id}/counts/delete`, { method: 'POST', body: {} })
    countsDeleted.value = true
  } catch (cause) {
    deleteError.value = errorMessage(cause)
  }
}
</script>

<template>
  <div>
    <nav aria-label="Breadcrumb" class="mb-5">
      <ol class="breadcrumb">
        <li><NuxtLink to="/sites">Usage</NuxtLink></li>
        <li class="font-mono">
          <NuxtLink :to="`/sites/${id}`">{{ id }}</NuxtLink>
        </li>
        <li aria-current="page">Settings</li>
      </ol>
    </nav>

    <div v-if="error" class="alert" data-tone="danger" role="alert">
      <div><strong>Could not load this site.</strong> {{ errorMessage(error) }}</div>
    </div>
    <div v-else-if="site" class="stack gap-6">
      <h1 class="text-l weight-600 font-mono">{{ site.id }}</h1>

      <div v-if="savedNotice" class="alert" data-tone="success" role="status">
        <div><strong>Saved.</strong> The next event the site sends is checked against it.</div>
      </div>
      <SiteForm :key="JSON.stringify(site)" :site="site" @saved="saved" />

      <section class="stack gap-3" aria-labelledby="embed-title">
        <h2 id="embed-title" class="text-s weight-600">Tracker</h2>
        <EmbedCode :code="embed" caption="JavaScript" />
        <small class="text-muted text-s"
          >Importing it counts a page view; call
          <code class="font-mono">track('export-start', { resolution: '1080p' })</code> for the
          rest. Until it has loaded, or if it never does, track() does nothing.</small
        >
      </section>

      <section class="stack gap-3 hairline-t pt-5" aria-labelledby="delete-title">
        <h2 id="delete-title" class="text-s weight-600">Delete</h2>
        <p class="text-s text-muted">
          Delete counts to start over, after testing for example: the settings and the tracker stay.
          Delete the site to remove it with all its counts; the tracker in it is refused from then
          on.
        </p>
        <p class="cluster gap-5">
          <button type="button" class="link text-danger" @click="ask('counts')">
            Delete counts
          </button>
          <button type="button" class="link text-danger" @click="ask('site')">
            Delete {{ site.id }}
          </button>
        </p>
        <div v-if="countsDeleted" class="alert" data-tone="success" role="status">
          <div>
            <strong>Counts deleted.</strong> <span class="font-mono">{{ id }}</span> counts again
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
      </section>
    </div>

    <ConfirmDialog
      v-model:open="deleteOpen"
      :title="REMOVALS[removal].title"
      :confirm-label="REMOVALS[removal].confirm"
      tone="danger"
      :disabled="typed !== id"
      @confirm="remove"
    >
      <template #description>{{ REMOVALS[removal].description }}</template>
      <div class="field">
        <label for="confirm-id"
          >Type <span class="font-mono">{{ id }}</span> to confirm</label
        >
        <input id="confirm-id" v-model="typed" class="input font-mono text-s" autocomplete="off" />
      </div>
    </ConfirmDialog>
  </div>
</template>
