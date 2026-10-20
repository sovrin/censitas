<script setup lang="ts">
import type { SiteConfig } from '#shared/contracts'
import { errorMessage } from '~/lib/format'

/** Adds a site, or changes one: who may send, and every event, prop and value that is counted.
 *  Nothing else is: a beacon with anything not listed here is refused. */
const props = defineProps<{ site?: SiteConfig }>()
const emit = defineEmits<{ saved: [SiteConfig] }>()

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

const id = ref(props.site?.id ?? '')
const origins = ref(props.site?.origins.join('\n') ?? '')
const events = ref<EventDraft[]>(
  props.site
    ? Object.entries(props.site.events).map(([name, rules]) =>
        newEvent(
          name,
          Object.entries(rules).map(([key, values]) => newProp(key, values.join(' '))),
        ),
      )
    : // The tracker counts a page view on import, so every site starts with it.
      [newEvent('pageview')],
)

const pending = ref(false)
const error = ref('')
const issues = ref<{ path: string; message: string }[]>([])
const fieldError = (path: string) =>
  issues.value.find((issue) => issue.path === path || issue.path.startsWith(`${path}.`))?.message

/** The drafts as the site's events. A name or prop given twice would silently merge, so it is
 *  reported here instead. */
function toEvents() {
  const result: SiteConfig['events'] = {}
  const repeated: { path: string; message: string }[] = []
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
  error.value = ''
  issues.value = []
  const { result, repeated } = toEvents()
  if (repeated.length) {
    issues.value = repeated
    return
  }
  pending.value = true
  const body: SiteConfig = {
    id: id.value,
    origins: origins.value
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean),
    events: result,
  }
  try {
    const saved = await $fetch<SiteConfig>(
      props.site ? `/api/sites/${props.site.id}` : '/api/sites',
      { method: 'POST', body },
    )
    emit('saved', saved)
  } catch (cause) {
    const data = (cause as { data?: { data?: { issues?: typeof issues.value } } }).data?.data
    if (data?.issues?.length) issues.value = data.issues
    else error.value = errorMessage(cause)
  } finally {
    pending.value = false
  }
}
</script>

<template>
  <form class="stack gap-5" @submit.prevent="save">
    <fieldset :disabled="pending" class="stack gap-5">
      <dl class="properties">
        <dt><label for="id">Id</label></dt>
        <dd class="field items-stretch">
          <input
            id="id"
            v-model="id"
            class="input font-mono text-s"
            data-size="s"
            required
            maxlength="64"
            placeholder="sonotas"
            autocomplete="off"
            spellcheck="false"
            :readonly="!!site"
            :aria-invalid="!!fieldError('id') || undefined"
            aria-describedby="id-help"
          />
          <small id="id-help">{{
            site
              ? 'Fixed: the tracker in the site names it.'
              : 'The tracker names it (?site=…). It cannot change later.'
          }}</small>
          <span v-if="fieldError('id')" data-error>{{ fieldError('id') }}</span>
        </dd>
        <dt><label for="origins">Origins</label></dt>
        <dd class="field items-stretch">
          <textarea
            id="origins"
            v-model="origins"
            class="input font-mono text-s"
            required
            spellcheck="false"
            placeholder="https://sonotas.example.com"
            :aria-invalid="!!fieldError('origins') || undefined"
            aria-describedby="origins-help"
          ></textarea>
          <small id="origins-help">One per line. Only these may send events.</small>
          <span v-if="fieldError('origins')" data-error>{{ fieldError('origins') }}</span>
        </dd>
      </dl>

      <div class="stack gap-4">
        <div class="stack gap-1">
          <span class="text-s weight-600">Events</span>
          <small class="text-muted text-s"
            >Each event the site sends, and for each prop every value it may take, separated by
            spaces. Anything not listed is refused, so a forged event can only raise a count that
            exists.</small
          >
        </div>
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
                  class="input font-mono text-s"
                  data-size="s"
                  :aria-label="`${event.name || `Event ${index + 1}`}: prop ${propIndex + 1}`"
                  placeholder="resolution"
                  required
                  spellcheck="false"
                  style="inline-size: 8rem"
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
              <button
                type="button"
                class="link text-s"
                data-quiet
                @click="event.props.push(newProp())"
              >
                Add a prop
              </button>
            </p>
          </div>
        </TransitionGroup>
        <span v-if="fieldError('events') && !events.length" class="text-s text-danger">{{
          fieldError('events')
        }}</span>
        <p>
          <button type="button" class="link text-s" @click="events.push(newEvent())">
            Add an event
          </button>
        </p>
      </div>
    </fieldset>

    <div v-if="issues.length || error" class="alert" data-tone="danger" role="alert">
      <div>
        <template v-if="error"><strong>Could not save the site.</strong> {{ error }}</template>
        <template v-else>
          <strong>Check these settings.</strong>
          <ul>
            <li v-for="issue in issues" :key="issue.path">
              <span class="font-mono">{{ issue.path }}</span
              >: {{ issue.message }}
            </li>
          </ul>
        </template>
      </div>
    </div>

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
        {{ site ? 'Save changes' : 'Add site' }}
      </button>
    </div>
  </form>
</template>
