<script setup lang="ts">
import { RANGES, type SiteReport } from '#shared/contracts'
import { errorMessage, formatCount, formatDay } from '~/lib/format'

const route = useRoute()
const id = computed(() => String(route.params.id))
const days = computed(() =>
  RANGES.some((range) => String(range) === route.query.days) ? Number(route.query.days) : 30,
)
useHead({ title: () => `${id.value} · censitas` })

const { data, error, refresh } = await useFetch<SiteReport>(() => `/api/sites/${id.value}`, {
  query: { days },
})

const counted = computed(() => data.value?.events.filter((event) => event.total) ?? [])
/** The events that carry props, for the breakdown. */
const broken = computed(() => counted.value.filter((event) => event.props.length))
const share = (count: number, total: number) =>
  total ? `${Math.round((count / total) * 100)}%` : '—'
</script>

<template>
  <div class="stack gap-6">
    <h1 class="sr-only">{{ id }}</h1>
    <div class="cluster justify-between gap-4">
      <nav aria-label="Breadcrumb">
        <ol class="breadcrumb">
          <li><NuxtLink to="/">All sites</NuxtLink></li>
          <li aria-current="page" class="font-mono">{{ id }}</li>
        </ol>
      </nav>
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
    </div>

    <div v-if="error" class="alert" data-tone="danger" role="alert">
      <div><strong>Could not load this site.</strong> {{ errorMessage(error) }}</div>
      <button type="button" class="btn" data-size="s" @click="refresh()">Try again</button>
    </div>
    <p v-else-if="data && !counted.length" class="text-muted">
      Nothing counted in the last {{ days }} days.
    </p>
    <template v-else-if="data">
      <section class="stack gap-3" aria-labelledby="daily">
        <h2 id="daily" class="text-s weight-600">Per day</h2>
        <div class="table-scroll" tabindex="0" aria-label="Events per day">
          <table class="table" data-size="s" data-hover="false">
            <thead>
              <tr>
                <th scope="col">Day (UTC)</th>
                <th v-for="event in counted" :key="event.name" scope="col" data-num>
                  <span class="font-mono nowrap">{{ event.name }}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="day in data.days" :key="day">
                <th scope="row" class="font-mono weight-400 text-muted nowrap">
                  <time :datetime="day">{{ formatDay(day, true) }}</time>
                </th>
                <td
                  v-for="event in counted"
                  :key="event.name"
                  data-num
                  :class="event.daily[day] ? undefined : 'text-muted'"
                >
                  {{ formatCount(event.daily[day] ?? 0) }}
                </td>
              </tr>
            </tbody>
            <tfoot>
              <tr>
                <th scope="row">Total</th>
                <td v-for="event in counted" :key="event.name" data-num class="weight-600">
                  {{ formatCount(event.total) }}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      <section
        v-for="event in broken"
        :key="event.name"
        class="stack gap-3"
        :aria-labelledby="`event-${event.name}`"
      >
        <div class="cluster justify-between gap-4">
          <h2 :id="`event-${event.name}`" class="text-s weight-600 font-mono">
            {{ event.name }}
          </h2>
          <span class="text-s text-muted tabular">{{ formatCount(event.total) }} in all</span>
        </div>
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
              <th scope="row" class="font-mono weight-400">{{ value.value }}</th>
              <td data-num :class="value.count ? undefined : 'text-muted'">
                {{ formatCount(value.count) }}
              </td>
              <td data-num class="text-muted">{{ share(value.count, event.total) }}</td>
            </tr>
          </tbody>
        </table>
      </section>
    </template>
  </div>
</template>
