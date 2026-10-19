<script setup lang="ts">
import type { SiteConfig } from '#shared/contracts'
useHead({ title: 'Add a site · censitas' })
const saved = (site: SiteConfig) => navigateTo(`/sites/${site.id}/settings`)
</script>

<template>
  <div>
    <nav aria-label="Breadcrumb" class="mb-5">
      <ol class="breadcrumb">
        <li><NuxtLink to="/">All sites</NuxtLink></li>
        <li aria-current="page">Add</li>
      </ol>
    </nav>
    <h1 class="text-l weight-600 mb-5">Add a site</h1>
    <SiteForm @saved="saved" />
  </div>
</template>
