<template>
  <dialog
    ref="dialog"
    aria-labelledby="submit-title"
    @cancel.prevent="requestClose"
    @click.self="requestClose"
  >
    <section>
      <h2 id="submit-title">确认正式提交？</h2>
      <p>提交后，本次训练内容将锁定，并生成正式评价。你可以先返回检查。</p>
      <div>
        <button
          type="button"
          class="secondary"
          autofocus
          :disabled="submitting"
          @click="requestClose"
        >
          返回检查
        </button>
        <button type="button" :disabled="submitting" @click="$emit('confirm')">
          {{ submitting ? '正在生成评价…' : '确认提交并评价' }}
        </button>
      </div>
    </section>
  </dialog>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
const props = defineProps<{ open: boolean; submitting: boolean }>()
const emit = defineEmits<{ close: []; confirm: [] }>()
const dialog = ref<HTMLDialogElement | null>(null)
watch(
  () => props.open,
  (open) => {
    if (open && !dialog.value?.open) dialog.value?.showModal()
    else if (!open && dialog.value?.open) dialog.value.close()
  },
  { flush: 'post', immediate: true },
)
watch(dialog, (element) => {
  if (element && props.open && !element.open) element.showModal()
})
function requestClose(): void {
  if (!props.submitting) emit('close')
}
</script>

<style scoped>
dialog {
  width: min(480px, calc(100% - 32px));
  max-height: calc(100dvh - 32px);
  padding: 0;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  color: var(--color-ink);
  background: var(--color-surface);
  box-shadow: var(--shadow-raised);
}
dialog[open] {
  animation: dialog-in 220ms var(--ease-out);
}
dialog::backdrop {
  background: rgb(19 39 32 / 38%);
}
section {
  padding: 28px;
}
@keyframes dialog-in {
  from {
    opacity: 0;
    transform: translateY(10px) scale(0.98);
  }
}
h2 {
  margin: 0;
}
p {
  color: var(--color-muted);
}
section div {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-3);
  margin-top: var(--space-6);
}
button {
  min-height: 42px;
  padding: 0 var(--space-4);
  border: 0;
  border-radius: var(--radius-sm);
  color: white;
  background: var(--color-primary);
}
.secondary {
  color: var(--color-ink);
  background: #edf1ef;
}
button:disabled {
  opacity: 0.55;
}
@media (max-width: 480px) {
  section {
    padding: 24px;
  }
  section div {
    flex-direction: column-reverse;
  }
}
</style>
