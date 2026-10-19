<script setup lang="ts">
import { RANGES, type SiteReport } from '#shared/contracts'
import { errorMessage, formatCount, formatDelta } from '~/lib/format'

const route = useRoute()
const id = computed(() => String(route.params.id))
const days = computed(() =>
  RANGES.some((range) => String(range) === route.query.days) ? Number(route.query.days) : 30,
)
useHead({ title: () => `${id.value} · censitas` })

const { data, error, refresh } = await useFetch<SiteReport>(() => `/api/sites/${id.value}/report`, {
  query: { days },
})

const counted = computed(() => data.value?.events.filter((event) => event.total) ?? [])
/** Page views lead with the large chart; every other event follows with its own. */
const views = computed(() => counted.value.find((event) => event.name === 'pageview'))
const others = computed(() => counted.value.filter((event) => event.name !== 'pageview'))
/** The headline figures: page views, then the three events counted most. */
const headline = computed(() => [
  ...(views.value ? [views.value] : []),
  ...others.value.toSorted((a, b) => b.total - a.total).slice(0, views.value ? 3 : 4),
])
const share = (count: number, total: number) => (total ? count / total : 0)
const percent = (value: number) => `${Math.round(value * 100)}%`
</script>

<template>
  <div class="stack gap-6">
    <div class="cluster justify-between gap-4">
      <nav aria-label="Breadcrumb">
        <ol class="breadcrumb">
          <li><NuxtLink to="/">All sites</NuxtLink></li>
          <li aria-current="page" class="font-mono">{{ id }}</li>
        </ol>
      </nav>
      <NuxtLink :to="`/sites/${id}/settings`" class="link text-s">Settings</NuxtLink>
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
    <template v-else-if="data">
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
                    ><span :style="{ inlineSize: percent(share(value.count, event.total)) }"></span
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
    </template>
  </div>
</template>
