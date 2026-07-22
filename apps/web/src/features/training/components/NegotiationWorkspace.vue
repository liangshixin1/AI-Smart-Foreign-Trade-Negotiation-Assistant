<template>
  <TrainingWorkspaceShell
    v-model:draft="draft"
    :attempt="attempt"
    :sending="sending"
    :send-message="sendMessage"
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
