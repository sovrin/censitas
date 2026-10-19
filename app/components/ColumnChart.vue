<script setup lang="ts">
import { formatCompact, formatCount, formatDay } from '~/lib/format'

/** <ColumnChart :name :days :daily size="l" />
 *  One event's counts per day as columns, oldest on the left, on a scale with three gridlines.
 *  Pointing at a day, or moving along with the arrow keys, reads it out above its column. One
 *  series in ink, so no legend: the section heading names it. Today is still running, so its
 *  column is lighter. Every value is also in the table under the chart. */
const props = withDefaults(
  defineProps<{ name: string; days: string[]; daily: Record<string, number>; size?: 'l' | 's' }>(),
  { size: 's' },
)

const points = computed(() =>
  props.days.toReversed().map((day) => ({ day, count: props.daily[day] ?? 0 })),
)
const count = computed(() => points.value.length)
const peak = computed(() =>
  points.value.reduce((best, point) => (point.count > best.count ? point : best)),
)
/** The top of the scale: the peak rounded up to 1, 2 or 5 times a power of ten, and even, so the
 *  middle line is a whole count (6, not 5 with 2.5 halfway). */
const top = computed(() => {
  const magnitude = 10 ** Math.floor(Math.log10(Math.max(1, peak.value.count)))
  const nice = [1, 2, 5, 10]
    .map((step) => step * magnitude)
    .find((value) => value >= peak.value.count)!
  return nice % 2 ? nice + 1 : nice
})
const ticks = computed(() => [top.value, top.value / 2, 0])

/** Four days to name under the axis, today and evenly back to the first: few enough to fit a
 *  phone at any range. */
const dateTicks = computed(() => {
  const last = count.value - 1
  const step = Math.max(1, Math.ceil(last / 3))
  const indexes = [...new Set([last, last - step, last - 2 * step, 0].filter((i) => i >= 0))]
  return indexes.map((index) => ({ index, day: points.value[index]!.day }))
})

/** Where a column's centre sits, and how a label above or below it is anchored so it stays
 *  inside the chart near the edges. */
function place(index: number) {
  const at = (index + 0.5) / count.value
  if (at < 0.15) return { insetInlineStart: '0' }
  if (at > 0.85) return { insetInlineEnd: '0' }
  return { insetInlineStart: `${at * 100}%`, translate: '-50% 0' }
}

const active = ref<number | null>(null)
const plot = ref<HTMLElement>()
function point(event: PointerEvent) {
  const box = plot.value!.getBoundingClientRect()
  const index = Math.floor(((event.clientX - box.left) / box.width) * count.value)
  active.value = Math.min(count.value - 1, Math.max(0, index))
}
function step(event: KeyboardEvent) {
  const last = count.value - 1
  const moves: Record<string, number> = {
    ArrowLeft: (active.value ?? last + 1) - 1,
    ArrowRight: (active.value ?? last - 1) + 1,
    Home: 0,
    End: last,
  }
  if (!(event.key in moves)) return
  event.preventDefault()
  active.value = Math.min(last, Math.max(0, moves[event.key]!))
}
const readout = computed(() => {
  if (active.value === null) return null
  const { day, count: value } = points.value[active.value]!
  return {
    value: formatCount(value),
    day: `${formatDay(day, true)}${active.value === count.value - 1 ? ', so far' : ''}`,
    style: place(active.value),
  }
})

const label = computed(
  () =>
    `${props.name} per day over ${count.value} days, at most ${formatCount(peak.value.count)} on ${formatDay(peak.value.day)}. Arrow keys read out each day.`,
)
</script>

<template>
  <figure class="stack gap-2">
    <div class="chart" :data-size="size" :data-dense="count > 60 || undefined">
      <div class="chart-scale font-mono text-xs text-muted tabular" aria-hidden="true">
        <span v-for="tick in ticks" :key="tick">{{ formatCompact(tick) }}</span>
      </div>
      <div
        ref="plot"
        class="chart-plot"
        role="img"
        tabindex="0"
        :aria-label="label"
        @pointermove="point"
        @pointerleave="active = null"
        @keydown="step"
        @blur="active = null"
      >
        <span class="chart-grid" aria-hidden="true"></span>
        <span
          v-for="(item, index) in points"
          :key="item.day"
          class="chart-slot"
          :data-active="active === index || undefined"
          :data-today="index === count - 1 || undefined"
          aria-hidden="true"
        >
          <span
            class="chart-bar"
            :style="{ '--value': item.count / top, '--at': index / count }"
          ></span>
        </span>
        <div v-if="readout" class="chart-readout" :style="readout.style" aria-live="polite">
          <b class="tabular">{{ readout.value }}</b>
          <span class="text-muted">{{ readout.day }}</span>
        </div>
      </div>
      <div class="chart-dates font-mono text-xs text-muted" aria-hidden="true">
        <span v-for="tick in dateTicks" :key="tick.day" :style="place(tick.index)">{{
          formatDay(tick.day)
        }}</span>
      </div>
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
