<script setup lang="ts">
import { RANGES, REFUSALS, type Refusal, type SiteReport } from '../../../../../shared/contracts'
import { errorMessage, formatCount, formatDay, formatDelta, plural } from '#nexitas/app/lib/format'

const project = useProject().id.value
const route = useRoute()
const days = computed(() =>
  RANGES.some((range) => String(range) === route.query.days) ? Number(route.query.days) : 30,
)
// Live: the counts move as beacons arrive, a few seconds apart at most.
const { data, error, refresh, status } = await useProjectFetch<SiteReport>('/sites/report', {
  query: { days },
})

/** No site: the project doesn't count, which is switched on on its page. */
const counting = computed(() => error.value?.statusCode !== 404)
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
    await $fetch(`/api/p/${project}/sites/refusals/clear`, { method: 'POST', body: {} })
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
  <AppPage
    title="Usage"
    failed="Could not load this site."
    :error="counting ? error : undefined"
    :retry="refresh"
  >
    <template v-if="data" #subtitle>
      <span class="font-mono break-words">{{ data.origins.join(' · ') }}</span>
    </template>
    <template v-if="counting" #actions>
      <!-- Colour only where the owner is needed: events the settings turn away. The details
             wait at the end of the page. -->
      <a v-if="data?.refused.total" href="#refused" class="link text-warning text-s"
        >{{ formatCount(data.refused.total) }} refused</a
      >
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
      <NuxtLink :to="`/p/${project}/sites/settings`" class="btn" data-size="s">Settings</NuxtLink>
    </template>

    <p v-if="!counting" class="text-muted">
      This project doesn't count its usage.
      <NuxtLink :to="`/p/${project}`" class="link">Count usage</NuxtLink> on its page to start.
    </p>
    <p v-else-if="data && !counted.length" class="text-muted">
      Nothing counted in the last {{ days }} days. The tracker to put in the site is under
      <NuxtLink :to="`/p/${project}/sites/settings`" class="link">Settings</NuxtLink>.
    </p>
    <div
      v-if="data && counted.length"
      class="refetch stack gap-6"
      :data-pending="changingRange || undefined"
    >
      <!-- The figures of the range, each against the same number of days before it. -->
      <div class="headline">
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

      <AppSection v-if="views" title="Page views per day">
        <ColumnChart name="pageview" :days="data.days" :daily="views.daily" size="l" />
      </AppSection>

      <AppSection v-for="event in others" :key="event.name">
        <template #title
          ><span class="font-mono">{{ event.name }}</span></template
        >
        <template #actions>
          <span class="cluster gap-2 text-muted tabular"
            >{{ formatCount(event.total) }} in {{ days }} days
            <span
              v-if="formatDelta(event.total, event.previous)"
              class="delta"
              :data-trend="formatDelta(event.total, event.previous)!.trend"
              >{{ formatDelta(event.total, event.previous)!.text }}</span
            ></span
          >
        </template>
        <ColumnChart :name="event.name" :days="data.days" :daily="event.daily" />
        <!-- Each prop's values by how often they came along, as a share of the event. -->
        <DataTable v-for="prop in event.props" :key="prop.key" data-hover="false">
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
        </DataTable>
      </AppSection>
    </div>

    <!-- Refused beacons mean the site sends something its settings don't list: those events are
         lost until the settings catch up. Only the reason is known; what was sent is never kept. -->
    <!-- The id is the header's link to it; it lands on the section. -->
    <AppSection v-if="data?.refused.total" id="refused" title="Refused">
      <template #actions>
        <button
          type="button"
          class="link"
          :disabled="clearing"
          :aria-busy="clearing || undefined"
          @click="clearRefused"
        >
          Clear
        </button>
      </template>
      <p class="text-s text-muted">
        {{ plural(data.refused.total, 'event') }} in the last {{ days }} days, the latest on
        {{ formatDay(data.refused.latest!) }}, sent something the
        <NuxtLink :to="`/p/${project}/sites/settings`" class="link">settings</NuxtLink> don't list,
        and weren't counted.
      </p>
      <ul class="text-s">
        <li v-for="refusal in refusals" :key="refusal.reason">
          <span class="tabular">{{ formatCount(refusal.count) }}</span> {{ refusal.label }}
        </li>
      </ul>
      <p class="text-xs text-muted">
        Clear forgets these for good, on every range; refusals after that show again.
      </p>
      <AppAlert v-if="clearError" title="Could not clear them.">{{ clearError }}</AppAlert>
    </AppSection>
  </AppPage>
</template>
