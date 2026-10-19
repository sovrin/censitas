<script setup lang="ts">
import type { SiteConfig } from '#shared/contracts'
import { errorMessage } from '~/lib/format'

const route = useRoute()
const id = route.params.id as string
const { data: site, error, refresh } = await useFetch<SiteConfig>(`/api/sites/${id}`)
useHead({ title: `${id} settings · censitas` })

const savedNotice = ref(false)
async function saved() {
  await refresh()
  savedNotice.value = true
}

// What a site puts in its code to count: the tracker, loaded in the background, and a track()
// that does nothing until it has loaded.
const origin = useRequestURL().origin
const embed = computed(() =>
  [
    `const TRACKER = '${origin}/v1/track.js?site=${id}'`,
    'let track = () => {}',
    'import(/* @vite-ignore */ TRACKER).then(',
    '  (module) => (track = module.track),',
    '  () => {},',
    ')',
  ].join('\n'),
)
const copied = ref(false)
async function copy() {
  await navigator.clipboard.writeText(embed.value)
  copied.value = true
  setTimeout(() => (copied.value = false), 2000)
}

const deleteOpen = ref(false)
const typed = ref('')
const deleteError = ref('')
async function remove() {
  deleteError.value = ''
  try {
    await $fetch(`/api/sites/${id}/delete`, { method: 'POST', body: {} })
    await navigateTo('/')
  } catch (cause) {
    deleteError.value = errorMessage(cause)
  }
}
</script>

<template>
  <div>
    <nav aria-label="Breadcrumb" class="mb-5">
      <ol class="breadcrumb">
        <li><NuxtLink to="/">All sites</NuxtLink></li>
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
        <div class="cluster justify-between gap-4">
          <h2 id="embed-title" class="text-s weight-600">Tracker</h2>
          <button
            type="button"
            class="btn"
            data-icon
            data-size="s"
            data-variant="ghost"
            :aria-label="copied ? 'Copied' : 'Copy the snippet'"
            :data-tip="copied ? 'Copied' : 'Copy the snippet'"
            @click="copy"
          >
            <i class="icon" :data-icon="copied ? 'check' : 'copy'"></i>
          </button>
        </div>
        <pre class="snippet font-mono text-xs"><code>{{ embed }}</code></pre>
        <small class="text-muted text-s"
          >Importing it counts a page view; call
          <code class="font-mono">track('export-start', { resolution: '1080p' })</code> for the
          rest. Until it has loaded, or if it never does, track() does nothing.</small
        >
      </section>

      <section class="stack gap-3 hairline-t pt-5" aria-labelledby="delete-title">
        <h2 id="delete-title" class="text-s weight-600">Delete</h2>
        <p class="text-s text-muted">
          Removes the site and all its counts. The tracker in it is refused from then on.
        </p>
        <p>
          <button type="button" class="link text-danger" @click="deleteOpen = true">
            Delete {{ site.id }}
          </button>
        </p>
        <div v-if="deleteError" class="alert" data-tone="danger" role="alert">
          <div><strong>Could not delete the site.</strong> {{ deleteError }}</div>
        </div>
      </section>
    </div>

    <ConfirmDialog
      v-model:open="deleteOpen"
      :title="`Delete ${id} and its counts?`"
      confirm-label="Delete site"
      tone="danger"
      :disabled="typed !== id"
      @confirm="remove"
    >
      <template #description>This cannot be undone.</template>
      <div class="field">
        <label for="confirm-id"
          >Type <span class="font-mono">{{ id }}</span> to confirm</label
        >
        <input id="confirm-id" v-model="typed" class="input font-mono text-s" autocomplete="off" />
      </div>
    </ConfirmDialog>
  </div>
</template>
