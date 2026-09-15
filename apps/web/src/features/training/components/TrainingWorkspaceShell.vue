<!-- [组件导读]
业务名词：Attempt 是一次训练记录；场景是本次任务与约束，逐轮反馈是单轮建议，正式评价在确认提交后形成。
用途：文字训练共用布局，组合场景简报、对话时间线、输入框和目标辅助区。
逻辑：管理简报折叠与移动端面板切换，调用 useAttemptScaffold 加载支持库；不同训练模式通过属性配置标题与输入提示。
结构：template 描述页面结构；script setup 声明输入、状态和事件；style 定义外观。
阅读线索：子组件 ConversationTimeline、MessageComposer、ScenarioBrief、TrainingChecklist；状态入口 useAttemptScaffold。
为什么：展示组件共用训练状态，避免各界面各自修改完成或评价结果；状态是否可操作由后端再次核对。
[/组件导读] -->
<template>
  <main :class="['workspace', `mobile-${mobilePanel}`, { 'brief-collapsed': briefCollapsed }]">
    <nav class="mobile-panels" aria-label="训练面板">
      <button
        v-for="panel in panels"
        :key="panel.id"
        type="button"
        :aria-pressed="mobilePanel === panel.id"
        :aria-controls="`training-${panel.id}`"
        @click="mobilePanel = panel.id"
      >
        {{ panel.label }}
      </button>
    </nav>
    <ScenarioBrief
      id="training-brief"
      class="brief-panel"
      :scenario="attempt.scenario"
      :collapsed="briefCollapsed"
      @toggle="briefCollapsed = !briefCollapsed"
    />
    <section
      id="training-conversation"
      :class="['conversation', { 'has-heading': workspaceLabel }]"
    >
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
      id="training-support"
      class="support-panel"
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
const mobilePanel = ref<'brief' | 'conversation' | 'support'>('conversation')
const panels = [
  { id: 'brief', label: '场景简报' },
  { id: 'conversation', label: '训练对话' },
  { id: 'support', label: '目标与辅助' },
] as const
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
.mobile-panels {
  display: none;
}
@media (max-width: 1100px) {
  .workspace,
  .workspace.brief-collapsed {
    grid-template-columns: 1fr;
    grid-template-rows: auto minmax(0, 1fr);
    height: 100%;
    overflow: hidden;
  }
  .mobile-panels {
    display: flex;
    gap: 4px;
    padding: 8px 12px;
    border-bottom: 1px solid var(--color-border);
    background: var(--color-surface);
  }
  .mobile-panels button {
    flex: 1;
    padding: 6px;
    border: 0;
    border-radius: 8px;
    background: transparent;
    color: var(--color-muted);
    font-size: 13px;
  }
  .mobile-panels button[aria-pressed='true'] {
    background: var(--color-primary-soft);
    color: var(--color-primary-strong);
    font-weight: 700;
  }
  .workspace:not(.mobile-brief) > .brief-panel,
  .workspace:not(.mobile-conversation) > .conversation,
  .workspace:not(.mobile-support) > .support-panel {
    display: none;
  }
  .conversation {
    min-height: 0;
  }
  .brief-panel,
  .support-panel {
    overflow-y: auto;
    min-height: 0;
  }
  .workspace-heading {
    padding: 10px 16px;
    flex-wrap: wrap;
    gap: 4px;
  }
}
@media (prefers-reduced-motion: reduce) {
  .workspace {
    transition: none;
  }
}
</style>
