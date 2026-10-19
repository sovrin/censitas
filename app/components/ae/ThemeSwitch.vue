<script setup lang="ts">
import { setTheme } from '@aequitas/aequitas.js'

/** <ThemeSwitch v-model="theme" />
 *  Three small text buttons; the current one is pressed. Pass the server-known mode (the `ae-theme`
 *  cookie) so it paints in its final state. Changing it calls setTheme(), which updates
 *  <html data-theme>, localStorage and the cookie. */
type Mode = 'light' | 'dark' | 'auto'

const mode = defineModel<Mode>({ default: 'auto' })

const OPTIONS = [
  { value: 'light', label: 'Light' },
  { value: 'auto', label: 'System' },
  { value: 'dark', label: 'Dark' },
] as const

function change(next: Mode) {
  mode.value = next
  setTheme(next)
}
</script>

<template>
  <span class="cluster gap-3 text-s" role="group" aria-label="Theme">
    <button
      v-for="option in OPTIONS"
      :key="option.value"
      type="button"
      class="link"
      :data-quiet="mode === option.value ? undefined : ''"
      :aria-pressed="mode === option.value"
      @click="change(option.value)"
    >
      {{ option.label }}
    </button>
  </span>
</template>
