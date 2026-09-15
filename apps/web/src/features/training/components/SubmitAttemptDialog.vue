<!-- [组件导读]
业务名词：Attempt 是一次训练记录；场景是本次任务与约束，逐轮反馈是单轮建议，正式评价在确认提交后形成。
用途：正式提交训练前的确认对话框。
逻辑：监听 open 与原生 dialog 元素的就绪状态，在 DOM 更新后调用 showModal/close；提交进行中阻止关闭，确认仅发出 confirm。
结构：template 描述页面结构；script setup 声明输入、状态和事件；style 定义外观。
为什么：正式提交会冻结训练，需独立确认；提交期间不关闭确认流程，避免误认为请求已取消。
[/组件导读] -->
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
// [导读] 提交未结束时阻止关闭，避免用户误以为提交流程已经取消。
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
