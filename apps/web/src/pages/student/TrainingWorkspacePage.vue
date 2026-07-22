<template>
  <div class="page-shell">
    <header class="topbar">
      <div>
        <RouterLink to="/student">退出训练</RouterLink>
        <strong>{{ attempt?.unit_title ?? '训练工作台' }}</strong>
      </div>
      <div>
        <AutosaveIndicator :state="displayAutosaveState" />
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
    <template v-else-if="attempt?.scenario">
      <p v-if="error" class="error-banner" role="alert">{{ error }}</p>
      <NegotiationWorkspace
        v-if="attempt.training_mode === 'negotiation'"
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
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import AutosaveIndicator from '@/features/training/components/AutosaveIndicator.vue'
import DocumentReviewWorkspace from '@/features/training/components/DocumentReviewWorkspace.vue'
import EmailWorkspace from '@/features/training/components/EmailWorkspace.vue'
import NegotiationWorkspace from '@/features/training/components/NegotiationWorkspace.vue'
import SubmitAttemptDialog from '@/features/training/components/SubmitAttemptDialog.vue'
import { useAttempt } from '@/features/training/composables/useAttempt'
import type { Attempt } from '@/features/training/types'

const route = useRoute()
const router = useRouter()
const attemptId = String(route.params.attemptId)
const { attempt, draft, autosaveState, loading, sending, submitting, error, reload, send, submit } =
  useAttempt(attemptId)
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
  if (attempt.value?.status === 'in_progress') return '训练中'
  if (attempt.value?.status === 'evaluation_failed') return '评价失败'
  if (attempt.value?.status === 'completed') return '已完成'
  return attempt.value?.status ?? '加载中'
})

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
  .topbar strong,
  .topbar :deep(span:first-child) {
    display: none;
  }
}
</style>
