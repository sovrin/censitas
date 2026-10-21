<script setup lang="ts">
import type { FieldIssue } from '#nexitas/shared/contracts'
import type { Site } from '../../shared/contracts'

/** Changes a site: every event, prop and value that is counted. Nothing else is: a beacon with
 *  anything not listed here is refused. Who may send is its project's origins, set there. */
const props = defineProps<{ site: Site }>()
const emit = defineEmits<{ saved: [Site] }>()

interface PropDraft {
  uid: number
  key: string
  values: string
}
interface EventDraft {
  uid: number
  name: string
  props: PropDraft[]
}

// Each row keeps one key for its life, so adding or removing a row animates that row, not the last.
let uids = 0
const newProp = (key = '', values = ''): PropDraft => ({ uid: ++uids, key, values })
const newEvent = (name = '', props: PropDraft[] = []): EventDraft => ({ uid: ++uids, name, props })

const events = ref<EventDraft[]>(
  Object.entries(props.site.events).map(([name, rules]) =>
    newEvent(
      name,
      Object.entries(rules).map(([key, values]) => newProp(key, values.join(' '))),
    ),
  ),
)

const { pending, error, issues, fieldError, submit } = useSubmit()

/** The drafts as the site's events. A name or prop given twice would silently merge, so it is
 *  reported here instead. */
function toEvents() {
  const result: Site['events'] = {}
  const repeated: FieldIssue[] = []
  for (const event of events.value) {
    const name = event.name.trim()
    if (Object.hasOwn(result, name))
      repeated.push({ path: `events.${name}`, message: 'Each event once.' })
    const rules: Record<string, string[]> = {}
    for (const prop of event.props) {
      const key = prop.key.trim()
      if (Object.hasOwn(rules, key))
        repeated.push({ path: `events.${name}.${key}`, message: 'Each prop once.' })
      rules[key] = prop.values.split(/[\s,]+/).filter(Boolean)
    }
    result[name] = rules
  }
  return { result, repeated }
}

async function save() {
  const { result, repeated } = toEvents()
  if (repeated.length) {
    error.value = ''
    issues.value = repeated
    return
  }
  const saved = await submit(() =>
    $fetch<Site>(`/api/p/${props.site.projectId}/sites/settings`, {
      method: 'POST',
      body: { events: result },
    }),
  )
  if (saved) emit('saved', saved)
}
</script>

<template>
  <form class="stack gap-5" @submit.prevent="save">
    <fieldset :disabled="pending" class="stack gap-5">
      <p class="text-s text-muted">
        Sent from <span class="font-mono break-words">{{ site.origins.join(' · ') }}</span
        >: the origins of
        <NuxtLink :to="`/p/${site.projectId}`" class="link">its project</NuxtLink>, which every
        module shares.
      </p>

      <div class="stack gap-4">
        <!-- Named by the page's heading above the form. -->
        <small
          >Each event the site sends, and for each prop every value it may take, separated by
          spaces. Anything not listed is refused, so a forged event can only raise a count that
          exists.</small
        >
        <!-- Rows ease in where they are added and out where removed; the rest make room. -->
        <TransitionGroup name="row" tag="div" class="stack gap-4 relative">
          <div
            v-for="(event, index) in events"
            :key="event.uid"
            class="stack gap-2"
            role="group"
            :aria-label="`Event ${index + 1}`"
          >
            <div class="cluster gap-3 flex-nowrap">
              <input
                v-model="event.name"
                class="input font-mono text-s flex-1 min-w-0"
                data-size="s"
                :aria-label="`Event ${index + 1}: name`"
                placeholder="export-start"
                required
                spellcheck="false"
                :aria-invalid="!!fieldError(`events.${event.name.trim()}`) || undefined"
              />
              <button
                type="button"
                class="btn"
                data-icon
                data-size="s"
                data-variant="ghost"
                :aria-label="`Remove event ${event.name || index + 1}`"
                data-tip="Remove"
                @click="events.splice(index, 1)"
              >
                <i class="icon" data-icon="x"></i>
              </button>
            </div>
            <TransitionGroup name="row" tag="div" class="stack gap-2 relative">
              <div
                v-for="(prop, propIndex) in event.props"
                :key="prop.uid"
                class="cluster gap-3 flex-nowrap ps-5"
              >
                <input
                  v-model="prop.key"
                  class="input font-mono text-s flex-1 min-w-0"
                  data-size="s"
                  :aria-label="`${event.name || `Event ${index + 1}`}: prop ${propIndex + 1}`"
                  placeholder="resolution"
                  required
                  spellcheck="false"
                  :aria-invalid="
                    !!fieldError(`events.${event.name.trim()}.${prop.key.trim()}`) || undefined
                  "
                />
                <input
                  v-model="prop.values"
                  class="input font-mono text-s flex-1 min-w-0"
                  data-size="s"
                  :aria-label="`${prop.key || `Prop ${propIndex + 1}`}: values`"
                  placeholder="720p 1080p 2160p"
                  required
                  spellcheck="false"
                />
                <button
                  type="button"
                  class="btn"
                  data-icon
                  data-size="s"
                  data-variant="ghost"
                  :aria-label="`Remove prop ${prop.key || propIndex + 1}`"
                  data-tip="Remove"
                  @click="event.props.splice(propIndex, 1)"
                >
                  <i class="icon" data-icon="x"></i>
                </button>
              </div>
            </TransitionGroup>
            <p class="ps-5">
              <button type="button" class="link text-s" @click="event.props.push(newProp())">
                Add a prop
              </button>
            </p>
          </div>
        </TransitionGroup>
        <p>
          <button type="button" class="link text-s" @click="events.push(newEvent())">
            Add an event
          </button>
        </p>
      </div>
    </fieldset>

    <FormIssues :error="error" :issues="issues" failed="Could not save the settings." />

    <div class="cluster gap-3 hairline-t pt-5">
      <p class="caption">Changes count from the next event on.</p>
      <button
        type="submit"
        class="btn end"
        data-size="s"
        data-variant="primary"
        :disabled="pending"
        :aria-busy="pending || undefined"
      >
        Save changes
      </button>
    </div>
  </form>
</template>
