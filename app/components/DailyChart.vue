<script setup lang="ts">
import { formatCompact, formatCount, formatDay } from '~/lib/format'

/** <DailyChart :name :days :daily />
 *  One event's counts per day as columns, oldest on the left. One series in ink, so no legend:
 *  the section heading names it. Every value is in the hover tip and in the table under it. */
const props = defineProps<{ name: string; days: string[]; daily: Record<string, number> }>()

const points = computed(() =>
  props.days.toReversed().map((day) => ({ day, count: props.daily[day] ?? 0 })),
)
const peak = computed(() =>
  points.value.reduce((best, point) => (point.count > best.count ? point : best)),
)
/** The top of the scale: the peak rounded up to 1, 2 or 5 times a power of ten. */
const top = computed(() => {
  const magnitude = 10 ** Math.floor(Math.log10(Math.max(1, peak.value.count)))
  return [1, 2, 5, 10].map((step) => step * magnitude).find((value) => value >= peak.value.count)!
})
const label = computed(
  () =>
    `${props.name} per day over ${props.days.length} days, at most ${formatCount(peak.value.count)} on ${formatDay(peak.value.day)}`,
)
</script>

<template>
  <figure class="stack gap-2">
    <div class="chart" role="img" :aria-label="label">
      <span class="chart-top font-mono text-xs text-muted tabular">{{ formatCompact(top) }}</span>
      <div class="chart-plot">
        <span
          v-for="point in points"
          :key="point.day"
          class="chart-slot"
          :data-tip="`${formatCount(point.count)} on ${formatDay(point.day, true)}`"
        >
          <span class="chart-bar" :style="{ blockSize: `${(point.count / top) * 100}%` }"></span>
        </span>
      </div>
    </div>
    <div class="cluster justify-between font-mono text-xs text-muted" aria-hidden="true">
      <span>{{ formatDay(points[0]!.day) }}</span>
      <span>{{ formatDay(points.at(-1)!.day) }}</span>
    </div>
    <details class="accordion text-s">
      <summary>Per day</summary>
      <table class="table" data-size="s" data-hover="false">
        <thead>
          <tr>
            <th scope="col">Day (UTC)</th>
            <th scope="col" data-num>
              <span class="font-mono">{{ name }}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="day in days" :key="day">
            <th scope="row" class="font-mono weight-400 text-muted nowrap">
              <time :datetime="day">{{ formatDay(day, true) }}</time>
            </th>
            <td data-num :class="daily[day] ? undefined : 'text-muted'">
              {{ formatCount(daily[day] ?? 0) }}
            </td>
          </tr>
        </tbody>
      </table>
    </details>
  </figure>
</template>
