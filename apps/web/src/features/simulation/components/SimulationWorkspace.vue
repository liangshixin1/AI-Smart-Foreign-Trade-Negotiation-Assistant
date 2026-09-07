<template>
  <main class="simulation-workspace">
    <NegotiationStatusBar
      :state="session.latest_state"
      :retrying="retryingAnalysis"
      @retry="$emit('retry-analysis')"
    />
    <div class="work-area">
      <section class="stage-wrap">
        <CharacterStage
          :display-name="session.display_name"
          :expression="activeExpression"
          :action="activeAction"
        />
        <nav class="stage-tools" aria-label="仿真工具">
          <button type="button" @click="showBriefing = true">简报</button>
          <button type="button" @click="showTranscript = true">历史</button>
          <button type="button" @click="toggleSupport">学习支持</button>
        </nav>
        <DialogueBox
          ref="dialogue"
          class="dialogue-box"
          :display-name="session.display_name"
          :turn="activeTurn"
          :thinking="sending"
        />
        <SimulationTranscript
          v-if="showTranscript"
          :messages="attempt.messages"
          :display-name="session.display_name"
          @close="showTranscript = false"
        />
        <section v-if="showBriefing" class="briefing-overlay">
          <BriefingPlayer
            :briefing="session.briefing"
            :briefing-status="session.briefing_status"
            :display-name="session.display_name"
            @enter="showBriefing = false"
          />
        </section>
      </section>
      <aside :class="{ open: showSupport }">
        <header>
          <strong>学习支持</strong><button type="button" @click="toggleSupport">关闭</button>
        </header>
        <TrainingKnowledgeScaffold
          :scaffold="scaffold"
          :loading="scaffoldLoading"
          :error="scaffoldError"
          :interacting-hint-id="interactingHintId"
          :recommendations="latestRecommendations"
          @retry="reloadScaffold"
          @reveal-hint="recordScaffoldEvent($event, 'revealed')"
          @use-hint="recordScaffoldEvent($event, 'used')"
        />
      </aside>
    </div>
    <form class="composer" @submit.prevent="submitReply">
      <label for="simulation-reply">你的回复</label>
      <textarea
        id="simulation-reply"
        v-model="draft"
        rows="2"
        :disabled="attempt.status !== 'in_progress' || sending"
        placeholder="以买方身份输入简短、完整的英文商务回复…"
        @keydown="handleComposerKeydown"
      ></textarea>
      <button type="submit" :disabled="!canSend">{{ sending ? '对方思考中…' : '发送' }}</button>
      <p v-if="readWarning" role="status">请先读完当前台词；草稿已保留。</p>
    </form>
  </main>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'

import TrainingKnowledgeScaffold from '@/features/knowledge-graph/components/TrainingKnowledgeScaffold.vue'
import { useAttemptScaffold } from '@/features/knowledge-graph/composables/useAttemptScaffold'
import type { Attempt } from '@/features/training/types'

import BriefingPlayer from './BriefingPlayer.vue'
import CharacterStage from './CharacterStage.vue'
import DialogueBox from './DialogueBox.vue'
import NegotiationStatusBar from './NegotiationStatusBar.vue'
import SimulationTranscript from './SimulationTranscript.vue'
import type { SimulationAction, SimulationExpression, SimulationSession } from '../types'

const props = defineProps<{
  attempt: Attempt & { scenario: NonNullable<Attempt['scenario']> }
  session: SimulationSession
  sending: boolean
  retryingAnalysis: boolean
  sendMessage: (content: string) => Promise<boolean>
}>()
defineEmits<{ 'retry-analysis': [] }>()
const draft = defineModel<string>('draft', { required: true })
const showSupport = ref(false)
const showTranscript = ref(false)
const showBriefing = ref(false)
const readWarning = ref(false)
const dialogue = ref<{
  complete: boolean
  expression: SimulationExpression
  action: SimulationAction
  showAll: () => void
} | null>(null)
const {
  scaffold,
  loading: scaffoldLoading,
  error: scaffoldError,
  interactingHintId,
  reload: reloadScaffold,
  recordEvent: recordScaffoldEvent,
} = useAttemptScaffold(props.attempt.id)
const activeTurn = computed(() => props.session.turns.at(-1) ?? null)
const activeExpression = computed(
  () => dialogue.value?.expression ?? activeTurn.value?.beats[0]?.expression ?? 'neutral',
)
const activeAction = computed(
  () => dialogue.value?.action ?? activeTurn.value?.beats[0]?.action ?? 'none',
)
const canSend = computed(
  () => Boolean(draft.value.trim()) && !props.sending && props.attempt.status === 'in_progress',
)
const latestRecommendations = computed(
  () => props.attempt.round_evaluations.at(-1)?.recommendations ?? [],
)

function toggleSupport(): void {
  showSupport.value = !showSupport.value
  if (showSupport.value) dialogue.value?.showAll()
}

async function submitReply(): Promise<void> {
  if (!canSend.value) return
  if (dialogue.value && !dialogue.value.complete) {
    dialogue.value.showAll()
    readWarning.value = true
    return
  }
  readWarning.value = false
  await props.sendMessage(draft.value.trim())
}

function handleComposerKeydown(event: KeyboardEvent): void {
  if (event.isComposing || event.key === 'Process') return
  if (event.key !== 'Enter' || event.shiftKey || event.altKey || event.ctrlKey || event.metaKey) {
    return
  }
  event.preventDefault()
  void submitReply()
}
</script>

<style scoped>
.simulation-workspace {
  position: relative;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  min-height: 0;
  overflow: hidden;
  background: #e9efec;
}
.work-area {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 0;
  min-height: 0;
  overflow: hidden;
  transition: grid-template-columns 180ms ease;
}
.work-area:has(aside.open) {
  grid-template-columns: minmax(0, 1fr) minmax(280px, 24vw);
}
.stage-wrap {
  position: relative;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}
.stage-wrap > :first-child {
  height: 100%;
}
.stage-tools {
  position: absolute;
  z-index: 5;
  top: 12px;
  left: 12px;
  display: flex;
  gap: 6px;
}
.stage-tools button,
aside header button {
  min-height: 34px;
  padding: 0 12px;
  border: 1px solid rgba(255, 255, 255, 0.5);
  border-radius: 8px;
  color: white;
  background: rgba(12, 33, 28, 0.72);
  backdrop-filter: blur(8px);
}
.dialogue-box {
  position: absolute;
  z-index: 4;
  right: 3%;
  bottom: 3%;
  left: 3%;
}
.briefing-overlay {
  position: absolute;
  z-index: 14;
  inset: 0;
  overflow: auto;
  padding: 10px;
  background: rgba(230, 238, 234, 0.98);
}
aside {
  position: relative;
  z-index: 7;
  min-width: 0;
  overflow-y: auto;
  border-left: 1px solid var(--color-border);
  background: white;
}
aside:not(.open) {
  visibility: hidden;
}
aside > header {
  position: sticky;
  z-index: 2;
  top: 0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px;
  border-bottom: 1px solid var(--color-border);
  background: white;
}
aside header button {
  color: var(--color-primary);
  background: transparent;
  border-color: var(--color-border);
}
aside :deep(.support-library) {
  margin: 0;
  padding: 14px;
  border: 0;
}
.composer {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: 10px;
  align-items: center;
  padding: 10px 14px;
  border-top: 1px solid var(--color-border);
  background: white;
}
.composer label {
  font-size: 0.8rem;
  font-weight: 700;
}
.composer textarea {
  min-height: 46px;
  max-height: 110px;
  resize: vertical;
  padding: 10px 12px;
  border: 1px solid var(--color-border);
  border-radius: 9px;
  font: inherit;
  line-height: 1.4;
}
.composer button {
  min-height: 44px;
  padding: 0 22px;
  border: 0;
  border-radius: 9px;
  color: white;
  background: var(--color-primary);
}
.composer button:disabled {
  opacity: 0.45;
}
.composer p {
  grid-column: 2 / 4;
  margin: -4px 0 0;
  color: var(--color-muted);
  font-size: 0.75rem;
}
@media (max-width: 900px) {
  .work-area,
  .work-area:has(aside.open) {
    grid-template-columns: 1fr;
  }
  aside {
    position: absolute;
    inset: 0 0 0 14%;
  }
  .composer {
    grid-template-columns: 1fr auto;
  }
  .composer label {
    display: none;
  }
  .composer p {
    grid-column: 1 / 3;
  }
}
@media (max-width: 600px) {
  .dialogue-box {
    right: 8px;
    bottom: 8px;
    left: 8px;
  }
  .stage-tools {
    top: 8px;
    left: 8px;
  }
  aside {
    inset: 0;
  }
  .composer {
    padding: 8px;
  }
  .composer textarea {
    min-height: 42px;
  }
  .composer button {
    padding: 0 14px;
  }
}
@media (prefers-reduced-motion: reduce) {
  .work-area {
    transition: none;
  }
}
</style>
