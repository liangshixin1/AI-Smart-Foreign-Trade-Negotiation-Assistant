<template>
  <article class="result">
    <header class="verdict">
      <div class="score-block">
        <p class="eyebrow">正式评价 · {{ evaluation.level }}</p>
        <h1>{{ Math.round(evaluation.overall_score) }}<small>/100</small></h1>
      </div>
      <div>
        <span class="conclusion-label">综合结论</span>
        <p>{{ evaluation.summary }}</p>
      </div>
    </header>

    <section class="dimension-section">
      <div class="section-heading">
        <div>
          <p class="eyebrow">能力画像</p>
          <h2>各维度表现</h2>
        </div>
        <p>图形用于快速比较；原始证据仍可逐项展开复核。</p>
      </div>
      <EvaluationRadarChart :dimensions="evaluation.dimensions" />
      <div class="dimension-list">
        <article v-for="dimension in evaluation.dimensions" :key="dimension.dimension_key">
          <div class="dimension-title">
            <strong>{{ dimension.label }}</strong>
            <span>{{ Math.round(dimension.score) }} 分</span>
          </div>
          <div class="score-track" aria-hidden="true">
            <i :style="{ width: `${dimension.score}%` }"></i>
          </div>
          <p>{{ dimension.comment }}</p>
          <details v-if="dimension.evidence.length" class="evidence-group">
            <summary>查看 {{ dimension.evidence.length }} 条评价证据</summary>
            <div
              v-for="evidence in dimension.evidence"
              :key="evidence.message_id + evidence.quote"
              class="evidence"
            >
              <strong>{{ evidence.reason }}</strong>
              <blockquote>“{{ compactQuote(evidence.quote) }}”</blockquote>
              <details v-if="isLongQuote(evidence.quote)">
                <summary>展开完整原文</summary>
                <p>{{ evidence.quote }}</p>
              </details>
            </div>
          </details>
        </article>
      </div>
    </section>

    <section class="feedback-grid">
      <div class="strengths">
        <p class="eyebrow">Keep</p>
        <h2>做得好的地方</h2>
        <ul>
          <li v-for="item in evaluation.strengths" :key="item">{{ item }}</li>
        </ul>
      </div>
      <div class="improvements">
        <p class="eyebrow">Improve</p>
        <h2>需要改进</h2>
        <ul>
          <li v-for="item in evaluation.improvements" :key="item">{{ item }}</li>
        </ul>
      </div>
      <div class="actions">
        <p class="eyebrow">Next</p>
        <h2>下一步行动</h2>
        <ol>
          <li v-for="item in evaluation.next_actions" :key="item">{{ item }}</li>
        </ol>
      </div>
    </section>
    <p class="provenance">
      模型 {{ evaluation.model_name }} · 提示词版本 {{ evaluation.prompt_version }}
    </p>
  </article>
</template>

<script setup lang="ts">
import type { EvaluationResult } from '@/features/training/types'

import EvaluationRadarChart from './EvaluationRadarChart.vue'

defineProps<{ evaluation: EvaluationResult }>()

const compactLimit = 180

function isLongQuote(quote: string): boolean {
  return quote.length > compactLimit
}

function compactQuote(quote: string): string {
  if (!isLongQuote(quote)) return quote
  return `${quote.slice(0, compactLimit).trimEnd()}…`
}
</script>

<style scoped>
.result {
  display: grid;
  gap: clamp(32px, 5vw, 56px);
}
.verdict {
  display: grid;
  grid-template-columns: minmax(160px, 0.35fr) 1fr;
  align-items: center;
  gap: clamp(28px, 5vw, 72px);
  padding: clamp(24px, 4vw, 44px);
  border: 1px solid color-mix(in srgb, var(--color-primary) 16%, var(--color-border));
  border-radius: var(--radius-lg, 20px);
  background:
    radial-gradient(
      circle at 8% 20%,
      color-mix(in srgb, var(--color-primary) 13%, transparent),
      transparent 38%
    ),
    var(--color-surface);
  box-shadow: var(--shadow-soft);
}
.score-block {
  padding-right: var(--space-6);
  border-right: 1px solid var(--color-border);
}
.eyebrow {
  margin: 0;
  color: var(--color-primary);
  font-size: 0.75rem;
  font-weight: 800;
  letter-spacing: 0.09em;
  text-transform: uppercase;
}
h1 {
  margin: var(--space-2) 0 0;
  font-size: clamp(3rem, 7vw, 4.8rem);
  line-height: 0.95;
  font-variant-numeric: tabular-nums;
}
h1 small {
  color: var(--color-muted);
  font-size: 1rem;
}
.conclusion-label {
  color: var(--color-muted);
  font-size: 0.8rem;
  font-weight: 700;
}
.verdict div:last-child p {
  max-width: 780px;
  margin: var(--space-2) 0 0;
  font-size: 1.08rem;
  line-height: 1.75;
}
.section-heading {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: var(--space-6);
  margin-bottom: var(--space-6);
}
.section-heading h2 {
  margin: var(--space-1) 0 0;
  font-size: 1.45rem;
}
.section-heading > p {
  max-width: 360px;
  margin: 0;
  color: var(--color-muted);
  font-size: 0.82rem;
  text-align: right;
}
.dimension-section > .radar {
  padding: var(--space-6);
  border-block: 1px solid var(--color-border);
}
.dimension-list {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0 var(--space-8);
  margin-top: var(--space-6);
}
.dimension-list > article {
  padding: var(--space-5, 20px) 0;
  border-bottom: 1px solid var(--color-border);
}
.dimension-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
}
.dimension-title span {
  color: var(--color-primary);
  font-weight: 800;
  font-variant-numeric: tabular-nums;
}
.score-track {
  height: 5px;
  margin-top: var(--space-3);
  overflow: hidden;
  border-radius: 999px;
  background: #e9eeeb;
}
.score-track i {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, var(--color-primary), #3f9b77);
}
.dimension-list article > p {
  margin: var(--space-3) 0 0;
  color: var(--color-muted);
  line-height: 1.65;
}
.evidence-group {
  margin-top: var(--space-3);
}
summary {
  color: var(--color-primary);
  font-size: 0.82rem;
  font-weight: 700;
  cursor: pointer;
}
.evidence {
  margin-top: var(--space-3);
  padding: var(--space-3) var(--space-4);
  border-left: 3px solid #b7d6c9;
  background: #f7faf8;
}
.evidence strong {
  font-size: 0.84rem;
}
blockquote,
.evidence p {
  margin: var(--space-2) 0 0;
  color: var(--color-muted);
  font-size: 0.84rem;
  white-space: pre-wrap;
}
.evidence details {
  margin-top: var(--space-2);
}
.feedback-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-6);
}
.feedback-grid > div {
  padding: var(--space-5, 20px);
  border-top: 3px solid var(--color-border);
  background: color-mix(in srgb, var(--color-surface) 70%, transparent);
}
.feedback-grid .strengths {
  border-color: #65a787;
}
.feedback-grid .improvements {
  border-color: #d4a649;
}
.feedback-grid .actions {
  border-color: #6c91b7;
}
.feedback-grid h2 {
  margin: var(--space-2) 0 var(--space-3);
  font-size: 1rem;
}
ul,
ol {
  margin: 0;
  padding-left: 1.2rem;
}
li + li {
  margin-top: var(--space-2);
}
.provenance {
  margin: 0;
  color: var(--color-muted);
  font-size: 0.78rem;
}
@media (max-width: 760px) {
  .verdict,
  .dimension-list,
  .feedback-grid {
    grid-template-columns: 1fr;
  }
  .score-block {
    padding: 0 0 var(--space-5, 20px);
    border: 0;
    border-bottom: 1px solid var(--color-border);
  }
  .section-heading {
    align-items: start;
    flex-direction: column;
  }
  .section-heading > p {
    text-align: left;
  }
}
</style>
