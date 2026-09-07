<template>
  <div class="page-shell">
    <header class="topbar">
      <div>
        <RouterLink to="/student">退出训练</RouterLink>
        <strong>{{ attempt?.unit_title ?? '训练工作台' }}</strong>
      </div>
      <div>
        <AutosaveIndicator v-if="attempt?.status === 'in_progress'" :state="displayAutosaveState" />
        <span class="status">{{ statusLabel }}</span>
        <button type="button" :disabled="!canSubmit" @click="showSubmitDialog = true">
          正式提交
        </button>
      </div>
    </header>
    <p v-if="loading" class="center-message">正在恢复训练记录…</p>
    <section v-else-if="error && !attempt" class="center-message" role="alert">
      <p>{{ error }}</p>
      <button type="button" @click="reload">重试</button>
    </section>
    <section v-else-if="attempt?.status === 'generation_failed'" class="recovery-card" role="alert">
      <p class="recovery-eyebrow">场景生成未完成</p>
      <h1>这次没有生成可用局面</h1>
      <p>系统已保留失败记录，但不会把它当作训练进度。返回本节即可重新生成。</p>
      <RouterLink :to="`/student/units/${attempt.unit_id}`">返回本节重新开始</RouterLink>
    </section>
    <template v-else-if="attempt?.scenario">
      <p v-if="error" class="error-banner" role="alert">{{ error }}</p>
      <SimulationWorkspace
        v-if="attempt.experience_mode === 'simulation' && simulationSession"
        v-model:draft="draft"
        :attempt="attemptWithScenario"
        :session="simulationSession"
        :sending="sending"
        :retrying-analysis="retryingAnalysis"
        :send-message="sendSimulationMessage"
        @retry-analysis="retryAnalysis"
      />
      <p v-else-if="attempt.experience_mode === 'simulation'" class="center-message">
        {{ simulationError || '正在恢复仿真舞台…' }}
      </p>
      <NegotiationWorkspace
        v-else-if="attempt.training_mode === 'negotiation'"
        v-model:draft="draft"
        :attempt="attemptWithScenario"
        :sending="sending"
        :send-message="send"
      />
      <EmailWorkspace
        v-else-if="attempt.training_mode === 'business_email'"
        v-model:draft="draft"
        :attempt="attemptWithScenario"
        :sending="sending"
        :send-message="send"
      />
      <DocumentReviewWorkspace
        v-else-if="attempt.training_mode === 'document_review'"
        v-model:draft="draft"
        :attempt="attemptWithScenario"
        :sending="sending"
        :send-message="send"
      />
    </template>
    <SubmitAttemptDialog
      :open="showSubmitDialog"
      :submitting="submitting"
      @close="showSubmitDialog = false"
      @confirm="confirmSubmit"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, defineAsyncComponent, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import AutosaveIndicator from '@/features/training/components/AutosaveIndicator.vue'
import DocumentReviewWorkspace from '@/features/training/components/DocumentReviewWorkspace.vue'
import EmailWorkspace from '@/features/training/components/EmailWorkspace.vue'
import NegotiationWorkspace from '@/features/training/components/NegotiationWorkspace.vue'
import SubmitAttemptDialog from '@/features/training/components/SubmitAttemptDialog.vue'
import { useAttempt } from '@/features/training/composables/useAttempt'
import type { Attempt } from '@/features/training/types'
import { useSimulationSession } from '@/features/simulation/composables/useSimulationSession'

const SimulationWorkspace = defineAsyncComponent(
  () => import('@/features/simulation/components/SimulationWorkspace.vue'),
)

const route = useRoute()
const router = useRouter()
const attemptId = String(route.params.attemptId)
const {
  attempt,
  draft,
  autosaveState,
  loading,
  sending,
  submitting,
  error,
  latestStreamEvent,
  reload,
  send,
  submit,
} = useAttempt(attemptId)
const isSimulation = computed(() => attempt.value?.experience_mode === 'simulation')
const {
  session: simulationSession,
  error: simulationError,
  retryingAnalysis,
  reload: reloadSimulation,
  retryAnalysis,
  applyPresentation,
  applyState,
} = useSimulationSession(attemptId, isSimulation)
const showSubmitDialog = ref(false)

const attemptWithScenario = computed(
  () => attempt.value as Attempt & { scenario: NonNullable<Attempt['scenario']> },
)
const displayAutosaveState = computed(() => (sending.value ? 'saving' : autosaveState.value))
const canSubmit = computed(
  () =>
    attempt.value?.status === 'in_progress' &&
    attempt.value.messages.some((message) => message.role === 'student') &&
    !sending.value,
)
const statusLabel = computed(() => {
  if (attempt.value?.status === 'generating_scenario') return '正在生成场景'
  if (attempt.value?.status === 'generation_failed') return '场景生成失败'
  if (attempt.value?.status === 'in_progress') return '训练中'
  if (attempt.value?.status === 'evaluation_failed') return '评价失败'
  if (attempt.value?.status === 'completed') return '已完成'
  return attempt.value?.status ?? '加载中'
})

watch(latestStreamEvent, (event) => {
  if (event?.type === 'simulation.turn.ready') applyPresentation(event.data)
  if (event?.type === 'simulation.state.updated') applyState(event.data)
})

async function sendSimulationMessage(content: string): Promise<boolean> {
  const completed = await send(content)
  if (completed) await reloadSimulation()
  return completed
}

async function confirmSubmit(): Promise<void> {
  const completed = await submit()
  showSubmitDialog.value = false
  if (completed || attempt.value?.status === 'evaluation_failed') {
    await router.push({ name: 'evaluation-result', params: { attemptId } })
  }
}
</script>

<style scoped>
.page-shell {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  height: 100vh;
  height: 100dvh;
  overflow: hidden;
  background: var(--color-surface);
}
.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
  min-height: 64px;
  padding: 0 var(--space-6);
  border-bottom: 1px solid var(--color-border);
}
.topbar > div {
  display: flex;
  align-items: center;
  gap: var(--space-4);
}
a {
  color: var(--color-muted);
}
.status {
  padding: var(--space-1) var(--space-2);
  border-radius: 999px;
  color: var(--color-primary-strong);
  background: #e5f2ec;
  font-size: 0.8rem;
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
  opacity: 0.45;
}
.center-message {
  align-self: center;
  justify-self: center;
}
.recovery-card {
  align-self: center;
  justify-self: center;
  width: min(520px, calc(100% - 32px));
  padding: var(--space-8);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  box-shadow: var(--shadow-soft);
}
.recovery-card h1 {
  margin: var(--space-2) 0 var(--space-3);
  font-size: 1.45rem;
}
.recovery-card p {
  color: var(--color-muted);
  line-height: 1.65;
}
.recovery-card .recovery-eyebrow {
  margin: 0;
  color: var(--color-danger);
  font-size: 0.78rem;
  font-weight: 800;
  letter-spacing: 0.08em;
}
.recovery-card a {
  display: inline-flex;
  min-height: 42px;
  margin-top: var(--space-4);
  padding: 0 var(--space-4);
  align-items: center;
  border-radius: var(--radius-sm);
  color: white;
  background: var(--color-primary);
  text-decoration: none;
}
.error-banner {
  position: fixed;
  z-index: 2;
  top: 72px;
  left: 50%;
  margin: 0;
  padding: var(--space-3) var(--space-4);
  transform: translateX(-50%);
  border: 1px solid #e2bbb7;
  border-radius: var(--radius-sm);
  color: var(--color-danger);
  background: #fff5f4;
}
@media (max-width: 760px) {
  .topbar {
    align-items: flex-start;
    flex-direction: column;
    padding: var(--space-3);
  }
  .topbar > div {
    width: 100%;
    justify-content: space-between;
  }
  .topbar strong {
    font-size: 13px;
    text-align: right;
  }
  .topbar > div {
    gap: 10px;
  }
  .topbar a {
    white-space: nowrap;
    font-size: 12px;
  }
  .topbar {
    gap: 8px;
  }
  .error-banner {
    width: calc(100% - 24px);
    top: 110px;
  }
}
</style>
