<!-- [组件导读]
业务名词：Attempt 是一次训练记录；场景是本次任务与约束，逐轮反馈是单轮建议，正式评价在确认提交后形成。
用途：将草稿保存或消息处理状态转成简洁的中文提示。
逻辑：只根据外部 state 选择文案；真正的自动保存由训练状态模块执行，组件本身不发起请求。
结构：template 描述页面结构；script setup 声明输入、状态和事件；style 定义外观。
为什么：展示组件共用训练状态，避免各界面各自修改完成或评价结果；状态是否可操作由后端再次核对。
[/组件导读] -->
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
