<script setup lang="ts">
/** A modal confirmation on the native <dialog>. The confirm button closes it and emits `confirm`;
 *  Cancel, Esc and the close button leave it without side effects. Focus starts on Cancel. */
const open = defineModel<boolean>('open', { required: true })
defineProps<{
  title: string
  confirmLabel: string
  cancelLabel?: string
  tone?: 'danger'
  disabled?: boolean
}>()
const emit = defineEmits<{ confirm: [] }>()
const dialog = ref<HTMLDialogElement>()
const id = useId()
function sync(value: boolean) {
  if (!dialog.value) return
  if (value && !dialog.value.open) dialog.value.showModal()
  if (!value && dialog.value.open) dialog.value.close()
}
watch(open, sync, { flush: 'post' })
onMounted(() => sync(open.value))
function confirm() {
  open.value = false
  emit('confirm')
}
</script>
<template>
  <dialog
    ref="dialog"
    role="alertdialog"
    :aria-labelledby="`${id}-title`"
    :aria-describedby="`${id}-description`"
    @close="open = false"
  >
    <div class="stack">
      <h2 :id="`${id}-title`" class="text-l weight-600">{{ title }}</h2>
      <p :id="`${id}-description`" class="text-muted"><slot name="description" /></p>
      <slot />
      <div class="cluster">
        <button
          type="button"
          class="btn"
          data-size="s"
          data-variant="primary"
          :data-tone="tone"
          :disabled="disabled"
          @click="confirm"
        >
          {{ confirmLabel }}
        </button>
        <button
          type="button"
          class="btn"
          data-size="s"
          data-variant="ghost"
          autofocus
          @click="open = false"
        >
          {{ cancelLabel || 'Cancel' }}
        </button>
      </div>
    </div>
  </dialog>
</template>
