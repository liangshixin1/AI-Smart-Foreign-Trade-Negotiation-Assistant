<template>
  <main :class="['workspace', { 'brief-collapsed': briefCollapsed }]">
    <ScenarioBrief
      :scenario="attempt.scenario"
      :collapsed="briefCollapsed"
      @toggle="briefCollapsed = !briefCollapsed"
    />
    <section :class="['conversation', { 'has-heading': workspaceLabel }]">
      <header v-if="workspaceLabel" class="workspace-heading">
        <strong>{{ workspaceLabel }}</strong>
        <span>{{ workspaceHint }}</span>
      </header>
      <ConversationTimeline :messages="attempt.messages" :evaluations="attempt.round_evaluations" />
      <MessageComposer
        v-model="draft"
        :disabled="attempt.status !== 'in_progress' || sending"
        :sending="sending"
        :send-message="sendMessage"
        :label="composerLabel"
        :placeholder="placeholder"
      />
    </section>
    <TrainingChecklist
      :scenario="attempt.scenario"
      :evaluations="attempt.round_evaluations"
      :scaffold="scaffold"
      :scaffold-loading="scaffoldLoading"
      :scaffold-error="scaffoldError"
      :interacting-hint-id="interactingHintId"
      @retry-scaffold="reloadScaffold"
      @reveal-hint="recordScaffoldEvent($event, 'revealed')"
      @use-hint="recordScaffoldEvent($event, 'used')"
    />
  </main>
</template>

<script setup lang="ts">
import { ref } from 'vue'

import { useAttemptScaffold } from '@/features/knowledge-graph'

import type { Attempt } from '../types'
import ConversationTimeline from './ConversationTimeline.vue'
import MessageComposer from './MessageComposer.vue'
import ScenarioBrief from './ScenarioBrief.vue'
import TrainingChecklist from './TrainingChecklist.vue'

const props = withDefaults(
  defineProps<{
    attempt: Attempt & { scenario: NonNullable<Attempt['scenario']> }
    sending: boolean
    sendMessage: (content: string) => Promise<boolean>
    workspaceLabel?: string
    workspaceHint?: string
    composerLabel?: string
    placeholder?: string
  }>(),
  {
    workspaceLabel: '',
    workspaceHint: '',
    composerLabel: '谈判回复',
    placeholder: '以买方身份输入英文商务回复…',
  },
)

const draft = defineModel<string>('draft', { required: true })
const briefCollapsed = ref(false)
const {
  scaffold,
  loading: scaffoldLoading,
  error: scaffoldError,
  interactingHintId,
  reload: reloadScaffold,
  recordEvent: recordScaffoldEvent,
} = useAttemptScaffold(props.attempt.id)
</script>

<style scoped>
.workspace {
  display: grid;
  grid-template-columns: minmax(238px, 25%) minmax(360px, 1fr) minmax(238px, 22%);
  height: 100%;
  min-height: 0;
  overflow: hidden;
  transition: grid-template-columns 220ms ease;
}
.workspace.brief-collapsed {
  grid-template-columns: 52px minmax(420px, 1fr) minmax(238px, 22%);
}
.conversation {
  display: grid;
  grid-template-rows: minmax(0, 1fr) auto;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  background: var(--color-canvas);
}
.conversation.has-heading {
  grid-template-rows: auto minmax(0, 1fr) auto;
}
.workspace-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
  min-height: 46px;
  padding: 0 var(--space-6);
  border-bottom: 1px solid var(--color-border);
  background: color-mix(in srgb, var(--color-surface) 92%, transparent);
}
.workspace-heading span {
  color: var(--color-muted);
  font-size: 0.8rem;
}
@media (max-width: 900px) {
  .workspace,
  .workspace.brief-collapsed {
    grid-template-columns: 1fr;
    height: auto;
    overflow-y: auto;
  }
  .conversation {
    min-height: 72vh;
  }
}
@media (prefers-reduced-motion: reduce) {
  .workspace {
    transition: none;
  }
}
</style>
