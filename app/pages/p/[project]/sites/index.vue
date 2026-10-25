<script setup lang="ts">
import {
  RANGES,
  REFUSALS,
  type ProjectUsage,
  type Refusal,
  type SiteReport,
} from '../../../../../shared/contracts'
import { formatCount, formatDay, formatDelta, plural } from '#nexitas/app/lib/format'
import TrackerCode from '../../../../components/TrackerCode.vue'

const project = useProject().id.value
const route = useRoute()
const days = computed(() =>
  RANGES.some((range) => String(range) === route.query.days) ? Number(route.query.days) : 30,
)
// Live: the counts move as beacons arrive, a few seconds apart at most.
const { data, error, refresh, status } = await useProjectFetch<SiteReport>('/sites/report', {
  query: { days },
})

// The site and its settings, for the setup; none until the project counts.
const {
  data: usage,
  error: usageError,
  refresh: refreshUsage,
} = await useProjectFetch<ProjectUsage>('/sites')
const site = computed(() => usage.value?.site)
const counting = computed(() => !!site.value)
const { open: setupOpen, openLink: setupLink, close: closeSetup } = useSetup()
const counted = computed(() => data.value?.events.filter((event) => event.total) ?? [])
/** Page views lead with the large chart; every other event follows with its own. */
const views = computed(() => counted.value.find((event) => event.name === 'pageview'))
const others = computed(() => counted.value.filter((event) => event.name !== 'pageview'))
/** The headline figures: page views, then the three events counted most. */
const headline = computed(() => [
  ...(views.value ? [views.value] : []),
  ...others.value.toSorted((a, b) => b.total - a.total).slice(0, views.value ? 3 : 4),
])
/** The lead: today's count so far, then the range against the one before. Every event counts,
 *  page views included; nothing here is about who sent them. */
const sum = (pick: (event: (typeof counted.value)[number]) => number) =>
  counted.value.reduce((total, event) => total + pick(event), 0)
const today = computed(() => sum((event) => event.daily[data.value!.days[0]!] ?? 0))
const total = computed(() => sum((event) => event.total))
const delta = computed(() =>
  formatDelta(
    total.value,
    sum((event) => event.previous),
  ),
)
const lead = computed(() =>
  today.value ? `${plural(today.value, 'event')} so far today` : 'Nothing counted yet today',
)
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
const { pending: clearing, error: clearError, submit } = useSubmit()
async function clearRefused() {
  await submit(async () => {
    await $fetch(`/api/p/${project}/sites/refusals/clear`, { method: 'POST', body: {} })
    await refresh()
  })
}

async function start() {
  // The tracker counts a page view on import, so a site starts with that event alone.
  await $fetch(`/api/p/${project}/sites`, { method: 'POST', body: { events: { pageview: {} } } })
  await Promise.all([refreshUsage(), refresh()])
}

const savedNotice = ref(false)
async function saved() {
  await refreshUsage()
  savedNotice.value = true
}

// Two things can go, each behind typing the project's id: its counts alone, or the whole site.
type Removal = 'counts' | 'site'
const removal = ref<Removal>('counts')
const { pending: removing, error: removeError, submit: submitRemoval } = useSubmit()
const countsDeleted = ref(false)
async function remove(next: Removal) {
  removal.value = next
  countsDeleted.value = false
  await submitRemoval(async () => {
    if (next === 'site') {
      await $fetch(`/api/p/${project}/sites/delete`, { method: 'POST', body: {} })
      // The project stays, with its other modules; this page offers to count again.
      await navigateTo(closeSetup.value)
      await refreshUsage()
      return
    }
    await $fetch(`/api/p/${project}/sites/counts/delete`, { method: 'POST', body: {} })
    await refresh()
    countsDeleted.value = true
  })
}

const share = (count: number, total: number) => (total ? count / total : 0)
const percent = (value: number) => `${Math.round(value * 100)}%`
</script>

<template>
  <AppPage
    title="Usage"
    failed="Could not load the usage."
    :error="usageError ?? (counting ? error : undefined)"
    :retry="usageError ? refreshUsage : refresh"
    aside-title="Setup"
    :aside-close="setupOpen ? closeSetup : undefined"
  >
    <!-- Today first, then the range it sits in; the range's choice follows in the filters. -->
    <template v-if="counting && data && counted.length" #lead>
      <AppLead :title="lead">
        <template #meta
          >{{ formatCount(total) }} in {{ days }} days<template v-if="delta">
            · {{ delta.text }} against the {{ days }} before</template
          ><template v-if="data.refused.total">
            ·
            <!-- Colour only where the owner is needed: events the settings turn away. The
               details wait at the end of the page. -->
            <a href="#refused" class="link" data-quiet
              ><StateDot tone="warning">{{ formatCount(data.refused.total) }} refused</StateDot></a
            ></template
          ></template
        >
      </AppLead>
    </template>
    <template v-if="counting" #actions>
      <SetupLink />
    </template>
    <template v-if="counting" #filters>
      <FilterLinks
        label="Range"
        :options="
          RANGES.map((range) => ({
            label: `${range} days`,
            to: { query: range === 30 ? {} : { days: String(range) } },
            current: days === range,
          }))
        "
      />
    </template>

    <ModuleStart
      v-if="usage && !counting"
      label="Count usage"
      failed="Could not start counting."
      :start="start"
    >
      Counts what happens on its pages, never who: no cookie, no identifier, no consent banner.
    </ModuleStart>
    <EmptyState v-else-if="data && !counted.length"
      >Nothing counted in the last {{ days }} days. The tracker to put in the site is under
      <NuxtLink :to="setupLink" class="link">Setup</NuxtLink>.</EmptyState
    >
    <!-- Refused sits in the same rhythm as the charts, and dims with them while a range loads. -->
    <div
      v-if="counting && data && (counted.length || data.refused.total)"
      class="refetch stack gap-6"
      :data-pending="changingRange || undefined"
    >
      <!-- The figures of the range, each against the same number of days before it. -->
      <div v-if="counted.length" class="headline">
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

      <!-- Refused beacons mean the site sends something its settings don't list: those events are
         lost until the settings catch up. Only the reason is known; what was sent is never kept. -->
      <!-- The id is the header's link to it; it lands on the section. -->
      <AppSection v-if="data?.refused.total" id="refused" title="Refused">
        <!-- How many is the lead's to say: here, when, and where to fix it. -->
        <p class="text-s text-muted">
          The latest on {{ formatDay(data.refused.latest!) }}. They sent something the
          <NuxtLink :to="setupLink" class="link">settings</NuxtLink> don't list, so weren't counted.
        </p>
        <ul class="text-s">
          <li v-for="refusal in refusals" :key="refusal.reason">
            <span class="tabular">{{ formatCount(refusal.count) }}</span> {{ refusal.label }}
          </li>
        </ul>
      </AppSection>
    </div>

    <!-- Everything to connect a site, then what it may send. -->
    <template v-if="site && setupOpen" #aside>
      <AppAlert v-if="countsDeleted" tone="success" title="Counts deleted."
        ><span class="font-mono">{{ project }}</span> counts again from zero.</AppAlert
      >
      <TrackerCode :site="site.id" />
      <AppSection title="Events">
        <AppAlert v-if="savedNotice" tone="success" title="Saved." />
        <SiteForm :key="JSON.stringify(site)" :site="site" @saved="saved" />
      </AppSection>
    </template>
    <template v-if="site && setupOpen" #danger>
      <span>Its counts, or its counts and settings; the project stays.</span>
      <DangerAction
        label="Delete counts"
        :title="`Delete everything ${project} counted?`"
        :confirm-word="project"
        :pending="removing"
        @confirm="remove('counts')"
      >
        To start over, after testing for example: its refusals go too; its settings and the tracker
        stay, and it counts again from zero. This cannot be undone.
      </DangerAction>
      <DangerAction
        label="Stop counting"
        :title="`Stop counting ${project}?`"
        :confirm-word="project"
        :pending="removing"
        @confirm="remove('site')"
      >
        The tracker in its pages is refused from then on. Counting again later starts from zero.
        This cannot be undone.
      </DangerAction>
      <AppAlert
        v-if="removeError"
        :title="removal === 'site' ? 'Could not stop counting.' : 'Could not delete the counts.'"
        >{{ removeError }}</AppAlert
      >
    </template>
    <template v-else-if="counting && data?.refused.total" #danger>
      <span>Forgets the refusals counted so far.</span>
      <DangerAction
        label="Clear refusals"
        title="Clear the refusals?"
        :pending="clearing"
        @confirm="clearRefused"
      >
        On every range. Refusals after that show again. This cannot be undone.
      </DangerAction>
      <AppAlert v-if="clearError" title="Could not clear them.">{{ clearError }}</AppAlert>
    </template>
  </AppPage>
</template>
