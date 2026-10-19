<script setup lang="ts">
import ThemeSwitch from '~/components/ae/ThemeSwitch.vue'
import { errorMessage } from '~/lib/format'
// Bumped by the release PR, so it names the release this build belongs to.
import { version } from '~~/package.json'
const route = useRoute()
const theme = useThemeMode()
const sections = [
  { to: '/', label: 'Sites', match: (path: string) => path === '/' || path.startsWith('/sites') },
]
const signingOut = ref(false)
const error = ref('')
async function logout() {
  signingOut.value = true
  error.value = ''
  try {
    await $fetch('/api/auth/logout', { method: 'POST', body: {} })
    clearNuxtData()
    await navigateTo('/login')
  } catch (cause) {
    error.value = errorMessage(cause)
  } finally {
    signingOut.value = false
  }
}
</script>

<template>
  <a class="skip-link" href="#main">Skip to content</a>
  <!-- One small column on a blank page, hanging from a fixed offset so a new range never moves
       what is under the cursor. -->
  <div class="center items-start" data-hang>
    <div class="stack gap-6">
      <nav class="cluster justify-between gap-4" aria-label="Main">
        <NuxtLink to="/" class="link weight-600 cluster gap-2 flex-nowrap" data-quiet
          ><LogoMark />censitas</NuxtLink
        >
        <span class="cluster gap-4">
          <NuxtLink
            v-for="section in sections"
            :key="section.to"
            :to="section.to"
            class="link"
            :data-quiet="section.match(route.path) ? undefined : ''"
            :aria-current="section.match(route.path) ? 'page' : undefined"
            >{{ section.label }}</NuxtLink
          >
        </span>
      </nav>
      <main id="main" tabindex="-1">
        <div v-if="error" class="alert mb-5" data-tone="danger" role="alert">
          <div><strong>Could not sign out.</strong> {{ error }}</div>
        </div>
        <slot />
      </main>
      <footer class="stack gap-3">
        <StatusLine />
        <div class="cluster justify-between gap-4">
          <ThemeSwitch v-model="theme" />
          <span class="cluster gap-3">
            <span class="font-mono text-xs text-muted">v{{ version }}</span>
            <button
              type="button"
              class="link text-s"
              data-quiet
              :disabled="signingOut"
              :aria-busy="signingOut || undefined"
              @click="logout"
            >
              Sign out
            </button>
          </span>
        </div>
      </footer>
    </div>
  </div>
</template>
