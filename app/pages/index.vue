<script setup lang="ts">
import type { SiteSummary } from '#shared/contracts'
import { errorMessage, formatCount } from '~/lib/format'
useHead({ title: 'Sites · censitas' })
const { data, error, refresh } = await useFetch<SiteSummary[]>('/api/sites')
</script>

<template>
  <div class="stack gap-5">
    <h1 class="sr-only">Sites</h1>
    <div v-if="error" class="alert" data-tone="danger" role="alert">
      <div><strong>Could not load the sites.</strong> {{ errorMessage(error) }}</div>
      <button type="button" class="btn" data-size="s" @click="refresh()">Try again</button>
    </div>
    <template v-else-if="data">
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
      <p v-else class="text-muted">No sites yet. Add one to get the tracker to put in it.</p>
      <p v-if="data.length" class="text-s text-muted">Counted over the last 30 days.</p>
      <p><NuxtLink to="/sites/new" class="link">Add a site</NuxtLink></p>
    </template>
  </div>
</template>
