<script setup lang="ts">
import { RANGES, REFUSALS, type Refusal, type SiteReport } from '../../../../shared/contracts'
import { errorMessage } from '#nexitas/app/lib/format'
import { formatCount, formatDay, formatDelta } from '../../../lib/format'

const route = useRoute()
const id = computed(() => String(route.params.id))
const days = computed(() =>
  RANGES.some((range) => String(range) === route.query.days) ? Number(route.query.days) : 30,
)
useHead({ title: () => `${id.value} · ${useRuntimeConfig().public.nexitas.name}` })

const { data, error, refresh, status } = await useFetch<SiteReport>(
  () => `/api/sites/${id.value}/report`,
  {
    query: { days },
  },
)

const counted = computed(() => data.value?.events.filter((event) => event.total) ?? [])
/** Page views lead with the large chart; every other event follows with its own. */
const views = computed(() => counted.value.find((event) => event.name === 'pageview'))
const others = computed(() => counted.value.filter((event) => event.name !== 'pageview'))
/** The headline figures: page views, then the three events counted most. */
const headline = computed(() => [
  ...(views.value ? [views.value] : []),
  ...others.value.toSorted((a, b) => b.total - a.total).slice(0, views.value ? 3 : 4),
])
/** What each refusal means, and where in the settings to look. */
const REFUSAL_LABELS: Record<Refusal, string> = {
  origin: 'from an origin not listed',
  event: 'with an event not listed',
  prop: 'with a prop not listed for its event',
  value: 'with a value not listed for its prop',
}
const refusals = computed(() =>
  REFUSALS.filter((reason) => data.value?.refused.reasons[reason]).map((reason) => ({
    reason,
    count: data.value!.refused.reasons[reason],
    label: REFUSAL_LABELS[reason],
  })),
)
// Live: the counts move as beacons arrive, a few seconds apart at most.
useLive(refresh)
/** Dimmed only while another range loads; a live refresh swaps the numbers in place. */
const changingRange = computed(
  () => status.value === 'pending' && data.value?.days.length !== days.value,
)

// Once the owner has dealt with refused beacons (fixed the settings, or knows why), they go;
// refusals that come after show again.
const clearing = ref(false)
const clearError = ref('')
async function clearRefused() {
  clearing.value = true
  clearError.value = ''
  try {
    await $fetch(`/api/sites/${id.value}/refusals/clear`, { method: 'POST', body: {} })
    await refresh()
  } catch (cause) {
    clearError.value = errorMessage(cause)
  } finally {
    clearing.value = false
  }
}

const share = (count: number, total: number) => (total ? count / total : 0)
const percent = (value: number) => `${Math.round(value * 100)}%`
</script>

<template>
  <div class="stack gap-6">
    <div class="cluster justify-between gap-4">
      <nav aria-label="Breadcrumb">
        <ol class="breadcrumb">
          <li><NuxtLink to="/sites">Usage</NuxtLink></li>
          <li aria-current="page" class="font-mono">{{ id }}</li>
        </ol>
      </nav>
      <span class="cluster gap-4 text-s">
        <!-- Colour only where the owner is needed: events the settings turn away. The details
             wait at the end of the page. -->
        <a v-if="data?.refused.total" href="#refused" class="link text-warning"
          >{{ formatCount(data.refused.total) }} refused</a
        >
        <NuxtLink :to="`/sites/${id}/settings`" class="link">Settings</NuxtLink>
      </span>
    </div>

    <header class="cluster justify-between items-end gap-4">
      <div class="stack gap-1 min-w-0">
        <h1 class="text-l weight-600 font-mono">{{ id }}</h1>
        <p v-if="data" class="font-mono text-xs text-muted break-words">
          {{ data.origins.join(' · ') }}
        </p>
      </div>
      <span class="cluster gap-3 text-s" role="group" aria-label="Range">
        <NuxtLink
          v-for="range in RANGES"
          :key="range"
          :to="{ query: range === 30 ? {} : { days: String(range) } }"
          class="link"
          :data-quiet="days === range ? undefined : ''"
          :aria-current="days === range ? 'page' : undefined"
          >{{ range }} days</NuxtLink
        >
      </span>
    </header>

    <div v-if="error" class="alert" data-tone="danger" role="alert">
      <div><strong>Could not load this site.</strong> {{ errorMessage(error) }}</div>
      <button type="button" class="btn" data-size="s" @click="refresh()">Try again</button>
    </div>
    <p v-else-if="data && !counted.length" class="text-muted">
      Nothing counted in the last {{ days }} days. The tracker to put in the site is under
      <NuxtLink :to="`/sites/${id}/settings`" class="link">Settings</NuxtLink>.
    </p>
    <div
      v-if="data && counted.length"
      class="refetch stack gap-6"
      :data-pending="changingRange || undefined"
    >
      <!-- The figures of the range, each against the same number of days before it. -->
      <div class="headline hairline-b pb-5">
        <div v-for="event in headline" :key="event.name" class="stat">
          <b>{{ formatCount(event.total) }}</b>
          <span class="cluster gap-2"
            ><span class="font-mono">{{ event.name }}</span>
            <span
              v-if="formatDelta(event.total, event.previous)"
              class="delta"
              :data-trend="formatDelta(event.total, event.previous)!.trend"
              :data-tip="`${formatCount(event.previous)} in the ${days} days before`"
              >{{ formatDelta(event.total, event.previous)!.text }}</span
            ></span
          >
        </div>
      </div>

      <section v-if="views" class="stack gap-3" aria-labelledby="event-pageview">
        <h2 id="event-pageview" class="text-s weight-600">Page views per day</h2>
        <ColumnChart name="pageview" :days="data.days" :daily="views.daily" size="l" />
      </section>

      <section
        v-for="event in others"
        :key="event.name"
        class="stack gap-4 hairline-t pt-5"
        :aria-labelledby="`event-${event.name}`"
      >
        <div class="cluster justify-between gap-4">
          <h2 :id="`event-${event.name}`" class="text-s weight-600 font-mono">
            {{ event.name }}
          </h2>
          <span class="cluster gap-2 text-s text-muted tabular"
            >{{ formatCount(event.total) }} in {{ days }} days
            <span
              v-if="formatDelta(event.total, event.previous)"
              class="delta"
              :data-trend="formatDelta(event.total, event.previous)!.trend"
              >{{ formatDelta(event.total, event.previous)!.text }}</span
            ></span
          >
        </div>
        <ColumnChart :name="event.name" :days="data.days" :daily="event.daily" />
        <!-- Each prop's values by how often they came along, as a share of the event. -->
        <table
          v-for="prop in event.props"
          :key="prop.key"
          class="table"
          data-size="s"
          data-hover="false"
        >
          <thead>
            <tr>
              <th scope="col">
                <span class="font-mono">{{ prop.key }}</span>
              </th>
              <th scope="col" data-num>Count</th>
              <th scope="col" data-num>Share</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="value in prop.values" :key="value.value">
              <th scope="row" class="font-mono weight-400">
                <span class="stack gap-1">
                  {{ value.value }}
                  <span class="share" aria-hidden="true"
                    ><span :style="{ '--value': share(value.count, event.total) }"></span
                  ></span>
                </span>
              </th>
              <td data-num :class="value.count ? undefined : 'text-muted'">
                {{ formatCount(value.count) }}
              </td>
              <td data-num class="text-muted">
                {{ event.total ? percent(share(value.count, event.total)) : '—' }}
              </td>
            </tr>
          </tbody>
        </table>
      </section>
    </div>

    <!-- Refused beacons mean the site sends something its settings don't list: those events are
         lost until the settings catch up. Only the reason is known; what was sent is never kept. -->
    <section
      v-if="data?.refused.total"
      id="refused"
      class="stack gap-3 hairline-t pt-5"
      aria-labelledby="refused-title"
    >
      <div class="cluster justify-between gap-4">
        <h2 id="refused-title" class="text-s weight-600">Refused</h2>
        <button
          type="button"
          class="link text-s"
          :disabled="clearing"
          :aria-busy="clearing || undefined"
          @click="clearRefused"
        >
          Clear
        </button>
      </div>
      <p class="text-s text-muted">
        {{ formatCount(data.refused.total) }}
        {{ data.refused.total === 1 ? 'event' : 'events' }} in the last {{ days }} days, the latest
        on {{ formatDay(data.refused.latest!) }}, sent something the
        <NuxtLink :to="`/sites/${id}/settings`" class="link">settings</NuxtLink> don't list, and
        weren't counted.
      </p>
      <ul class="text-s">
        <li v-for="refusal in refusals" :key="refusal.reason">
          <span class="tabular">{{ formatCount(refusal.count) }}</span> {{ refusal.label }}
        </li>
      </ul>
      <p class="text-xs text-muted">
        Clear forgets these for good, on every range; refusals after that show again.
      </p>
      <div v-if="clearError" class="alert" data-tone="danger" role="alert">
        <div><strong>Could not clear them.</strong> {{ clearError }}</div>
      </div>
    </section>
  </div>
</template>
