<script setup lang="ts">
// Render the saved theme on the server, so the first paint is already final.
const theme = useThemeMode()
useHead({ htmlAttrs: { 'data-theme': () => (theme.value === 'auto' ? undefined : theme.value) } })
</script>

<template>
  <NuxtRouteAnnouncer />
  <NuxtLayout><NuxtPage /></NuxtLayout>
</template>
