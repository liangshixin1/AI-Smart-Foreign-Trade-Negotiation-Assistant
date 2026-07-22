<template>
  <div v-if="open" class="backdrop" role="presentation" @click.self="$emit('close')">
    <section role="dialog" aria-modal="true" aria-labelledby="submit-title">
      <h2 id="submit-title">确认正式提交？</h2>
      <p>提交后，本次场景和全部消息将被冻结；系统随后生成正式评价，不能静默修改。</p>
      <div>
        <button type="button" class="secondary" :disabled="submitting" @click="$emit('close')">
          返回检查
        </button>
        <button type="button" :disabled="submitting" @click="$emit('confirm')">
          {{ submitting ? '正在生成评价…' : '确认提交并评价' }}
        </button>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
defineProps<{ open: boolean; submitting: boolean }>()
defineEmits<{ close: []; confirm: [] }>()
</script>

<style scoped>
.backdrop {
  position: fixed;
  inset: 0;
  z-index: 10;
  display: grid;
  place-items: center;
  padding: var(--space-6);
  background: rgb(11 28 21 / 45%);
}
section {
  width: min(480px, 100%);
  padding: var(--space-6);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  box-shadow: var(--shadow-soft);
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
</style>
