<script setup lang="ts">
import { trackerSnippet } from '../lib/embed'

/** <TrackerCode :site="site.id" />
 *  The tracker a site puts in its code, and how to use it: the first thing Usage's setup shows. */
defineProps<{ site: string }>()
const origin = useRequestURL().origin
</script>

<template>
  <div class="stack gap-3">
    <EmbedCode :code="trackerSnippet(origin, site)" />
    <small class="text-muted"
      >Importing it counts a page view; call
      <code class="font-mono">track('export-start', { resolution: '1080p' })</code> for the rest,
      once the settings list them. Until it has loaded, or if it never does, track() does
      nothing.</small
    >
  </div>
</template>
