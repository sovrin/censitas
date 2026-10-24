<script setup lang="ts">
/** <NotCounting />
 *  What censitas' pages say for a project that doesn't count: counting starts on its page. */
const project = useProject().id
</script>

<template>
  <EmptyState
    >This project doesn't count usage yet. Start it on
    <NuxtLink :to="`/p/${project}`" class="link">the project's page</NuxtLink>.</EmptyState
  >
</template>
