<template>
  <aside class="feedback" aria-label="本轮即时评价">
    <header>
      <strong>本轮即时反馈</strong><span>{{ Math.round(evaluation.score) }} 分</span>
    </header>
    <dl>
      <div>
        <dt>Pros</dt>
        <dd>{{ evaluation.pros }}</dd>
      </div>
      <div>
        <dt>Cons</dt>
        <dd>{{ evaluation.cons }}</dd>
      </div>
    </dl>
    <details>
      <summary>查看详细评价</summary>
      <p>{{ evaluation.detailed_evaluation }}</p>
    </details>
    <p class="next"><strong>下一步：</strong>{{ evaluation.next_step_suggestion }}</p>
  </aside>
</template>

<script setup lang="ts">
import type { RoundEvaluation } from '../types'

defineProps<{ evaluation: RoundEvaluation }>()
</script>

<style scoped>
.feedback {
  width: min(82%, 680px);
  padding: var(--space-3) var(--space-4);
  border-left: 3px solid #d19a38;
  background: #fffaf0;
}
header {
  display: flex;
  justify-content: space-between;
  gap: var(--space-3);
}
header span {
  color: #805a18;
  font-weight: 700;
}
dl {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-3);
  margin: var(--space-3) 0;
}
dt {
  color: var(--color-muted);
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
}
dd {
  margin: var(--space-1) 0 0;
}
summary {
  cursor: pointer;
  color: var(--color-primary);
}
details p,
.next {
  margin: var(--space-2) 0 0;
  color: var(--color-muted);
}
@media (max-width: 640px) {
  dl {
    grid-template-columns: 1fr;
  }
}
</style>
