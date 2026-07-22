<template>
  <TrainingWorkspaceShell
    v-model:draft="draft"
    :attempt="attempt"
    :sending="sending"
    :send-message="sendMessage"
    workspace-label="单证审阅工作台"
    workspace-hint="按“问题—风险—修改”提交"
    composer-label="审阅意见"
    placeholder="列出条款位置、不符点、风险与改证建议…"
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
