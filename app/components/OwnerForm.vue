<script setup lang="ts">
import { errorMessage } from '~/lib/format'
const props = defineProps<{ setup?: boolean }>()
const email = ref('')
const password = ref('')
const token = ref('')
const error = ref('')
const pending = ref(false)
async function submit() {
  pending.value = true
  error.value = ''
  try {
    await $fetch(props.setup ? '/api/auth/setup' : '/api/auth/login', {
      method: 'POST',
      body: {
        email: email.value,
        password: password.value,
        ...(props.setup ? { token: token.value.trim() } : {}),
      },
    })
    password.value = ''
    token.value = ''
    await navigateTo('/')
  } catch (cause) {
    error.value = errorMessage(cause)
  } finally {
    pending.value = false
  }
}
</script>

<template>
  <!-- No focusable element precedes the email field: setup starts typing on the first Tab. -->
  <main class="center">
    <div class="stack gap-6">
      <strong class="weight-600 cluster gap-2 flex-nowrap"><LogoMark />censitas</strong>
      <div class="stack gap-3">
        <h1 class="text-l weight-600">{{ setup ? 'Make yourself at home.' : 'Welcome back.' }}</h1>
        <p class="text-muted">
          {{
            setup
              ? 'Create the owner account. What every site you add counts arrives here.'
              : 'Sign in to see how your sites are used.'
          }}
        </p>
      </div>
      <form class="stack gap-5" @submit.prevent="submit">
        <fieldset :disabled="pending" class="stack gap-4">
          <div class="field">
            <label for="email">Email</label>
            <input
              id="email"
              v-model="email"
              class="input"
              type="email"
              autocomplete="username"
              placeholder="you@example.com"
              required
              maxlength="254"
            />
          </div>
          <div class="field">
            <label for="password">Password</label>
            <input
              id="password"
              v-model="password"
              class="input"
              type="password"
              :autocomplete="setup ? 'new-password' : 'current-password'"
              required
              minlength="12"
              maxlength="256"
              :aria-describedby="setup ? 'password-help' : undefined"
            />
            <small v-if="setup" id="password-help"
              >At least 12 characters. A passphrase works well.</small
            >
          </div>
          <div v-if="setup" class="field">
            <label for="token">Installation key</label>
            <input
              id="token"
              v-model="token"
              class="input font-mono text-s"
              type="password"
              autocomplete="off"
              required
              minlength="32"
              maxlength="256"
              aria-describedby="token-help"
            />
            <small id="token-help"
              >CENSITAS_BOOTSTRAP_TOKEN from the server. It protects this first setup.</small
            >
          </div>
        </fieldset>
        <div v-if="error" class="alert" data-tone="danger" role="alert">
          <div>
            <strong>{{ setup ? 'Could not create the account.' : 'Could not sign in.' }}</strong>
            {{ error }}
          </div>
        </div>
        <button
          type="submit"
          class="btn"
          data-size="s"
          data-variant="primary"
          :disabled="pending"
          :aria-busy="pending || undefined"
        >
          {{ setup ? 'Create owner account' : 'Sign in' }}
        </button>
      </form>
      <p class="caption">
        <i class="icon" data-icon="lock" data-size="s" aria-hidden="true"></i>
        {{
          setup
            ? 'One owner. Your server. The counts stay on it.'
            : 'Access is limited to the owner.'
        }}
      </p>
    </div>
  </main>
</template>
