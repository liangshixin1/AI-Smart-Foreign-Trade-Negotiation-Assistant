<template>
  <aside class="checklist" aria-label="训练任务清单">
    <section>
      <p class="eyebrow">任务导航</p>
      <h2>本轮目标</h2>
      <ol class="targets">
        <li v-for="target in scenario.negotiation_targets" :key="target">{{ target }}</li>
      </ol>
    </section>
    <section class="precheck">
      <header>
        <div>
          <p class="eyebrow">Checklist</p>
          <h3>看看自己做到了...</h3>
        </div>
        <span class="live-badge">自动更新</span>
      </header>
      <p class="precheck-note">知己知彼，百战不殆</p>
      <div class="check-items">
        <article
          v-for="item in scenario.checklist"
          :key="`${latestEvaluation?.id ?? 'pending'}-${item}`"
          :class="['check-item', stateFor(item)]"
        >
          <span class="status-icon" aria-hidden="true">{{ iconFor(item) }}</span>
          <div>
            <strong>{{ item }}</strong>
            <p>{{ rationaleFor(item) }}</p>
          </div>
        </article>
      </div>
    </section>
    <TrainingKnowledgeScaffold
      :scaffold="scaffold"
      :loading="scaffoldLoading"
      :error="scaffoldError"
      :interacting-hint-id="interactingHintId"
      :recommendations="latestEvaluation?.recommendations ?? []"
      @retry="$emit('retry-scaffold')"
      @reveal-hint="$emit('reveal-hint', $event)"
      @use-hint="$emit('use-hint', $event)"
    />
  </aside>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import { TrainingKnowledgeScaffold } from '@/features/knowledge-graph'
import type { AttemptScaffold, ScaffoldHint } from '@/features/knowledge-graph'

import type { RoundEvaluation, ScenarioPublic } from '../types'

const props = defineProps<{
  scenario: ScenarioPublic
  evaluations: RoundEvaluation[]
  scaffold: AttemptScaffold | null
  scaffoldLoading: boolean
  scaffoldError: string | null
  interactingHintId: string | null
}>()
defineEmits<{
  'retry-scaffold': []
  'reveal-hint': [hint: ScaffoldHint]
  'use-hint': [hint: ScaffoldHint]
}>()

const latestEvaluation = computed(() => props.evaluations.at(-1))
const latestResults = computed(
  () => new Map(latestEvaluation.value?.checklist_results.map((result) => [result.item, result])),
)

function stateFor(item: string): 'satisfied' | 'missing' | 'pending' {
  const result = latestResults.value.get(item)
  if (!result) return 'pending'
  return result.satisfied ? 'satisfied' : 'missing'
}

function iconFor(item: string): string {
  return { satisfied: '✓', missing: '!', pending: '·' }[stateFor(item)]
}

function rationaleFor(item: string): string {
  return latestResults.value.get(item)?.rationale ?? '发送一轮内容后，由评价 Agent 自动预审。'
}
</script>

<style scoped>
.checklist {
  padding: var(--space-6);
  overflow: auto;
  border-left: 1px solid var(--color-border);
  background: linear-gradient(180deg, var(--color-surface), #fafcfb);
}
.eyebrow {
  margin: 0 0 var(--space-1);
  color: var(--color-primary);
  font-size: 0.7rem;
  font-weight: 800;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}
h2,
h3 {
  margin: 0;
  font-size: 1rem;
}
.targets {
  display: grid;
  gap: var(--space-3);
  margin: var(--space-4) 0 0;
  padding: 0;
  list-style: none;
}
.targets li {
  position: relative;
  padding-left: 1.6rem;
  color: var(--color-muted);
  line-height: 1.5;
}
.targets li::before {
  position: absolute;
  left: 0;
  width: 1.1rem;
  height: 1.1rem;
  border-radius: 50%;
  color: var(--color-primary);
  background: var(--color-primary-soft, #e8f3ee);
  content: '→';
  font-size: 0.7rem;
  font-weight: 800;
  line-height: 1.1rem;
  text-align: center;
}
.precheck {
  margin-top: var(--space-8);
  padding-top: var(--space-6);
  border-top: 1px solid var(--color-border);
}
.precheck header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
}
.live-badge {
  padding: 0.25rem 0.5rem;
  border-radius: 999px;
  color: var(--color-primary);
  background: var(--color-primary-soft, #e8f3ee);
  font-size: 0.7rem;
  font-weight: 700;
  white-space: nowrap;
}
.precheck-note {
  margin: var(--space-3) 0 0;
  color: var(--color-muted);
  font-size: 0.78rem;
  line-height: 1.5;
}
.check-items {
  display: grid;
  gap: var(--space-2);
  margin-top: var(--space-4);
}
.check-item {
  display: grid;
  grid-template-columns: 24px 1fr;
  gap: var(--space-2);
  padding: var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  animation: status-in 180ms ease-out both;
}
.status-icon {
  display: grid;
  width: 22px;
  height: 22px;
  place-items: center;
  border-radius: 50%;
  color: var(--color-muted);
  background: #eef1ef;
  font-weight: 800;
}
.check-item.satisfied {
  border-color: #b6d9c9;
  background: #f4faf7;
}
.check-item.satisfied .status-icon {
  color: white;
  background: var(--color-primary);
}
.check-item.missing {
  border-color: #ead7ad;
  background: #fffbf3;
}
.check-item.missing .status-icon {
  color: #795817;
  background: #f5dfaa;
}
.check-item strong {
  display: block;
  font-size: 0.84rem;
  line-height: 1.45;
}
.check-item p {
  margin: var(--space-1) 0 0;
  color: var(--color-muted);
  font-size: 0.75rem;
  line-height: 1.45;
}
@keyframes status-in {
  from {
    opacity: 0;
    transform: translateY(4px);
  }
}
@media (prefers-reduced-motion: reduce) {
  .check-item {
    animation: none;
  }
}
</style>
