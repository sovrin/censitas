<script setup lang="ts">
import { sitesFileSchema, type SiteSummary, type SitesFile } from '#shared/contracts'
import { errorMessage, formatCount } from '~/lib/format'
useHead({ title: 'Sites · censitas' })
const { data, error, refresh } = await useFetch<SiteSummary[]>('/api/sites')

// Import: the file is read and checked here first, so the owner sees what it adds and replaces
// before anything changes. The server checks it again.
const fileInput = ref<HTMLInputElement>()
const pendingFile = ref<SitesFile | null>(null)
const importOpen = ref(false)
const importError = ref('')
const importIssues = ref<{ path: string; message: string }[]>([])
interface Imported {
  added: string[]
  replaced: string[]
}
const imported = ref<Imported | null>(null)
const existing = computed(() => new Set(data.value?.map((site) => site.id)))
const incoming = computed(() => {
  const ids = pendingFile.value?.sites.map((site) => site.id) ?? []
  return {
    added: ids.filter((id) => !existing.value.has(id)),
    replaced: ids.filter((id) => existing.value.has(id)),
  }
})

async function chooseFile(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = '' // the same file can be chosen again after a fix
  importError.value = ''
  importIssues.value = []
  imported.value = null
  if (!file) return
  let json: unknown
  try {
    json = JSON.parse(await file.text())
  } catch {
    importError.value = `${file.name} is not JSON.`
    return
  }
  const parsed = sitesFileSchema.safeParse(json)
  if (!parsed.success) {
    importIssues.value = parsed.error.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
    }))
    return
  }
  pendingFile.value = parsed.data
  importOpen.value = true
}

async function runImport() {
  if (!pendingFile.value) return
  // The file stays: the dialog still shows it while it fades out. The next choice replaces it.
  try {
    imported.value = await $fetch<Imported>('/api/import', {
      method: 'POST',
      body: pendingFile.value,
    })
    await refresh()
  } catch (cause) {
    importError.value = errorMessage(cause)
  }
}

const list = (ids: string[]) => ids.join(', ')
</script>

<template>
  <div class="stack gap-5">
    <h1 class="sr-only">Sites</h1>
    <div v-if="error" class="alert" data-tone="danger" role="alert">
      <div><strong>Could not load the sites.</strong> {{ errorMessage(error) }}</div>
      <button type="button" class="btn" data-size="s" @click="refresh()">Try again</button>
    </div>
    <template v-else-if="data">
      <div v-if="imported" class="alert" data-tone="success" role="status">
        <div>
          <strong>Imported.</strong>
          <template v-if="imported.added.length">
            Added <span class="font-mono">{{ list(imported.added) }}</span
            >.
          </template>
          <template v-if="imported.replaced.length">
            Replaced the settings of <span class="font-mono">{{ list(imported.replaced) }}</span
            >.
          </template>
        </div>
      </div>
      <div v-if="importError || importIssues.length" class="alert" data-tone="danger" role="alert">
        <div>
          <strong>Could not import the file.</strong>
          <template v-if="importError"> {{ importError }}</template>
          <ul v-else>
            <li v-for="issue in importIssues" :key="issue.path">
              <span class="font-mono">{{ issue.path || 'file' }}</span
              >: {{ issue.message }}
            </li>
          </ul>
        </div>
      </div>

      <ul v-if="data.length" data-variant="plain" aria-label="Sites">
        <li v-for="site in data" :key="site.id" class="py-3 hairline-b">
          <div class="cluster gap-3 flex-nowrap">
            <!-- Green while the site is sending; untoned when it has gone quiet for a month. -->
            <span
              class="dot"
              :data-tone="site.events ? 'success' : undefined"
              aria-hidden="true"
            ></span>
            <NuxtLink
              :to="`/sites/${site.id}`"
              class="link font-mono flex-1 min-w-0 break-words"
              data-quiet
              >{{ site.id }}</NuxtLink
            >
            <span v-if="site.events" class="text-muted tabular"
              >{{ formatCount(site.pageviews) }} views · {{ formatCount(site.events) }} events</span
            >
            <span v-else class="text-muted">quiet</span>
          </div>
          <p class="ps-4 font-mono text-xs text-muted break-words">
            {{ site.origins.join(' · ') }}
          </p>
        </li>
      </ul>
      <p v-else class="text-muted">
        No sites yet. Add one to get the tracker to put in it, or import a sites file.
      </p>
      <p v-if="data.length" class="text-s text-muted">Counted over the last 30 days.</p>
      <div class="cluster gap-4">
        <NuxtLink to="/sites/new" class="link">Add a site</NuxtLink>
        <span class="cluster gap-3 text-s end">
          <button type="button" class="link" data-quiet @click="fileInput?.click()">Import</button>
          <!-- Settings only: what each site may send, never its counts. -->
          <a v-if="data.length" href="/api/export" class="link" data-quiet download>Export</a>
        </span>
        <input
          ref="fileInput"
          type="file"
          accept=".json,application/json"
          hidden
          aria-label="Sites file to import"
          @change="chooseFile"
        />
      </div>
    </template>

    <ConfirmDialog
      v-model:open="importOpen"
      :title="`Import ${pendingFile?.sites.length ?? 0} ${pendingFile?.sites.length === 1 ? 'site' : 'sites'}?`"
      confirm-label="Import"
      @confirm="runImport"
    >
      <template #description>
        <template v-if="incoming.added.length"
          >Adds <span class="font-mono">{{ list(incoming.added) }}</span
          >.
        </template>
        <template v-if="incoming.replaced.length"
          >Replaces the settings of <span class="font-mono">{{ list(incoming.replaced) }}</span
          >; their counts stay.
        </template>
      </template>
    </ConfirmDialog>
  </div>
</template>
