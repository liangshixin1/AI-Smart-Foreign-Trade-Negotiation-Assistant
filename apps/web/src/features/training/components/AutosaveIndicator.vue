<template>
  <span :class="{ problem: state === 'error' }">{{ label }}</span>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{ state: 'idle' | 'saved' | 'saving' | 'error' }>()
const label = computed(() => {
  if (props.state === 'saving') return '正在保存并等待回复…'
  if (props.state === 'error') return '保存或回复失败，请查看提示'
  if (props.state === 'idle') return '草稿有变更，稍后自动保存'
  return '训练消息已保存'
})
</script>

<style scoped>
span {
  color: var(--color-muted);
  font-size: 0.8rem;
}
.problem {
  color: var(--color-danger);
}
</style>
