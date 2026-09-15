<!-- [组件导读]
业务名词：Attempt 是一次训练记录；场景是本次任务与约束，逐轮反馈是单轮建议，正式评价在确认提交后形成。
用途：训练文本输入框，负责草稿编辑及调用发送回调。
逻辑：提交时去掉首尾空白，检查空内容和禁用状态；仅当 sendMessage 返回成功后清空草稿，失败时保留输入。
结构：template 描述页面结构；script setup 声明输入、状态和事件；style 定义外观。
为什么：网络或模型调用可能失败，成功回执前保留输入，避免学生重新组织整段回复。
[/组件导读] -->
<template>
  <form class="composer" @submit.prevent="submitDraft">
    <label class="sr-only" for="training-message">{{ label }}</label>
    <textarea
      id="training-message"
      v-model="draft"
      :disabled="disabled"
      rows="3"
      :placeholder="placeholder"
      @keydown.meta.enter.prevent="submitDraft"
      @keydown.ctrl.enter.prevent="submitDraft"
    />
    <div>
      <span>⌘/Ctrl + Enter 发送</span>
      <button type="submit" :disabled="disabled || !draft.trim()">
        {{ sending ? '等待 AI 回复…' : '发送消息' }}
      </button>
    </div>
  </form>
</template>

<script setup lang="ts">
const props = defineProps<{
  disabled: boolean
  sending: boolean
  sendMessage: (content: string) => Promise<boolean>
  label?: string
  placeholder?: string
}>()
const label = props.label ?? '谈判回复'
const placeholder = props.placeholder ?? '以买方身份输入英文商务回复…'
const draft = defineModel<string>({ default: '' })

// [导读] 校验内容后等待外部发送结果，成功才清空双向绑定的草稿。
async function submitDraft(): Promise<void> {
  const content = draft.value.trim()
  if (!content || props.disabled) return
  if (await props.sendMessage(content)) draft.value = ''
}
</script>

<style scoped>
.composer {
  padding: var(--space-4) var(--space-6);
  border-top: 1px solid var(--color-border);
  background: var(--color-surface);
}
textarea {
  width: 100%;
  resize: vertical;
  min-height: 76px;
  padding: var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  color: var(--color-ink);
  background: #fbfcfb;
}
.composer div {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
  margin-top: var(--space-2);
}
span {
  color: var(--color-muted);
  font-size: 0.78rem;
}
button {
  min-height: 40px;
  padding: 0 var(--space-4);
  border: 0;
  border-radius: var(--radius-sm);
  color: white;
  background: var(--color-primary);
}
button:disabled {
  opacity: 0.55;
}
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
}
@media (max-width: 640px) {
  .composer {
    padding: 12px 14px max(12px, env(safe-area-inset-bottom));
  }
  textarea {
    min-height: 72px;
    max-height: 28dvh;
  }
  .composer div {
    gap: 8px;
  }
  .composer span {
    font-size: 10px;
  }
}
</style>
