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
</style>
