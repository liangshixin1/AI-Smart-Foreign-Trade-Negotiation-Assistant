<template>
  <TrainingWorkspaceShell
    v-model:draft="draft"
    :attempt="attempt"
    :sending="sending"
    :send-message="sendMessage"
    workspace-label="商务邮件工作台"
    workspace-hint="使用英文完成当前任务"
    composer-label="英文商务邮件"
    placeholder="输入邮件正文（称呼、任务要点、结尾）…"
  />
</template>
<script setup lang="ts">
import type { Attempt } from '../types'
import TrainingWorkspaceShell from './TrainingWorkspaceShell.vue'
defineProps<{
  attempt: Attempt & { scenario: NonNullable<Attempt['scenario']> }
  sending: boolean
  sendMessage: (content: string) => Promise<boolean>
}>()
const draft = defineModel<string>('draft', { required: true })
</script>
