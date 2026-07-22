<template>
  <section class="support-library" aria-labelledby="support-library-title">
    <header class="library-heading">
      <div>
        <p class="eyebrow">智能学习支持</p>
        <h3 id="support-library-title">你可能需要的…</h3>
      </div>
      <button v-if="error" type="button" class="retry-button" @click="$emit('retry')">重试</button>
    </header>

    <p v-if="loading" class="state">正在匹配当前局面所需的知识与策略…</p>
    <p v-else-if="error" class="state error" role="alert">{{ error }}</p>
    <p v-else-if="!scaffold" class="state">当前训练暂未配置学习支持。</p>

    <template v-else>
      <article v-if="scaffold.phenomena[0]" class="phenomenon">
        <span>当前局面</span>
        <strong>{{ scaffold.phenomena[0].label }}</strong>
        <p>{{ propertyText(scaffold.phenomena[0], 'cue', '请结合场景线索判断对方意图。') }}</p>
      </article>

      <div class="support-groups">
        <details class="support-group knowledge-group">
          <summary>
            <span class="group-icon" aria-hidden="true">知</span>
            <span class="group-label">知识资源</span>
            <strong class="group-count">{{ scaffold.knowledge_resources.length }}</strong>
            <span class="chevron" aria-hidden="true">⌄</span>
          </summary>
          <div class="group-content">
            <p v-if="!scaffold.knowledge_resources.length" class="empty-group">暂无知识资源。</p>
            <ul v-else>
              <li
                v-for="resource in scaffold.knowledge_resources"
                :key="resource.id"
                :class="{ recommended: recommendationFor(resource.id) }"
              >
                <div class="item-meta">
                  <span class="kind">{{
                    propertyText(resource, 'resource_type', '知识资源')
                  }}</span>
                  <span v-if="recommendationFor(resource.id)" class="round-badge">本轮建议</span>
                </div>
                <RouterLink :to="learningRoute(resource.id)">{{ resource.label }}</RouterLink>
                <p>
                  {{
                    propertyFirst(
                      resource,
                      ['Summary', 'Definition_Content', 'explanation'],
                      '用于理解并处理当前商务局面。',
                    )
                  }}
                </p>
                <p v-if="recommendationFor(resource.id)" class="recommendation-reason">
                  {{ recommendationFor(resource.id)?.reason }}
                </p>
              </li>
            </ul>
          </div>
        </details>

        <details class="support-group strategy-group">
          <summary>
            <span class="group-icon" aria-hidden="true">策</span>
            <span class="group-label">策略技巧</span>
            <strong class="group-count">{{ scaffold.strategies.length }}</strong>
            <span class="chevron" aria-hidden="true">⌄</span>
          </summary>
          <div class="group-content">
            <p v-if="!scaffold.strategies.length" class="empty-group">暂无策略技巧。</p>
            <ul v-else>
              <li
                v-for="strategy in scaffold.strategies"
                :key="strategy.id"
                :class="{ recommended: recommendationFor(strategy.id) }"
              >
                <div v-if="recommendationFor(strategy.id)" class="item-meta">
                  <span class="round-badge">本轮建议</span>
                </div>
                <RouterLink :to="learningRoute(strategy.id)">{{ strategy.label }}</RouterLink>
                <p>
                  {{
                    propertyFirst(
                      strategy,
                      ['Summary', 'RecommendedActions', 'action'],
                      '根据当前条件选择合适的应对行动。',
                    )
                  }}
                </p>
                <p v-if="recommendationFor(strategy.id)" class="recommendation-reason">
                  {{ recommendationFor(strategy.id)?.reason }}
                </p>
                <blockquote v-if="propertyText(strategy, 'expression')">
                  {{ propertyText(strategy, 'expression') }}
                </blockquote>
              </li>
            </ul>
          </div>
        </details>

        <details class="support-group hint-group">
          <summary>
            <span class="group-icon" aria-hidden="true">提</span>
            <span class="group-label">线索提示</span>
            <strong class="group-count">{{ scaffold.scaffolds.length }}</strong>
            <span class="chevron" aria-hidden="true">⌄</span>
          </summary>
          <div class="group-content hints">
            <p v-if="!scaffold.scaffolds.length" class="empty-group">暂无线索提示。</p>
            <template v-else>
              <p class="hint-intro">需要时逐级展开，避免过早暴露完整答案。</p>
              <article v-for="hint in scaffold.scaffolds" :key="hint.id" class="hint">
                <div>
                  <strong>{{ hint.level }}</strong>
                  <span v-if="hint.used" class="used">已采用</span>
                </div>
                <p>{{ hint.trigger }}</p>
                <template v-if="hint.revealed">
                  <blockquote>{{ hint.content }}</blockquote>
                  <button
                    v-if="!hint.used"
                    type="button"
                    :disabled="interactingHintId === hint.id"
                    @click="$emit('use-hint', hint)"
                  >
                    {{ interactingHintId === hint.id ? '记录中…' : '标记为已采用' }}
                  </button>
                </template>
                <button
                  v-else
                  type="button"
                  :disabled="interactingHintId === hint.id"
                  @click="$emit('reveal-hint', hint)"
                >
                  {{ interactingHintId === hint.id ? '展开中…' : '展开本级提示' }}
                </button>
              </article>
            </template>
          </div>
        </details>
      </div>
    </template>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

import type { AttemptScaffold, KnowledgeGraphNode, ScaffoldHint } from '../types'

interface SupportRecommendation {
  node_id: string
  node_type: 'knowledge_resource' | 'strategy'
  title: string
  confidence: number
  reason: string
  reveal_level: number
}

const route = useRoute()
const props = defineProps<{
  scaffold: AttemptScaffold | null
  loading: boolean
  error: string | null
  interactingHintId: string | null
  recommendations: SupportRecommendation[]
}>()
defineEmits<{
  retry: []
  'reveal-hint': [hint: ScaffoldHint]
  'use-hint': [hint: ScaffoldHint]
}>()

// 评价 Agent 只负责从固定候选中选择重点，不改变当前关卡的支持库内容。
const recommendationsById = computed(
  () => new Map(props.recommendations.map((item) => [item.node_id, item])),
)

function recommendationFor(nodeId: string): SupportRecommendation | undefined {
  return recommendationsById.value.get(nodeId)
}

function propertyText(node: KnowledgeGraphNode, key: string, fallback = ''): string {
  const value = node.properties[key]
  return typeof value === 'string' ? value : fallback
}

function propertyFirst(node: KnowledgeGraphNode, keys: string[], fallback: string): string {
  for (const key of keys) {
    const value = propertyText(node, key)
    if (value) return value
  }
  return fallback
}

function learningRoute(nodeId: string): { path: string; query: { returnTo: string } } {
  return {
    path: `/student/knowledge/${encodeURIComponent(nodeId)}`,
    query: { returnTo: route.fullPath },
  }
}
</script>

<style scoped>
.support-library {
  margin-top: var(--space-6);
  padding-top: var(--space-5);
  border-top: 1px solid var(--color-border);
}
.library-heading,
summary,
.item-meta,
.hint > div {
  display: flex;
  align-items: center;
}
.library-heading {
  justify-content: space-between;
  gap: var(--space-2);
}
.eyebrow,
h3,
.phenomenon p {
  margin: 0;
}
.eyebrow {
  color: var(--color-primary);
  font-size: 0.68rem;
  font-weight: 800;
  letter-spacing: 0.09em;
}
h3 {
  font-size: 1rem;
}
button {
  border: 0;
  color: var(--color-primary);
  background: transparent;
  cursor: pointer;
}
.retry-button {
  font-weight: 700;
}
.state,
.library-note,
.empty-group {
  color: var(--color-muted);
  font-size: 0.76rem;
  line-height: 1.5;
}
.error {
  color: var(--color-danger);
}
.phenomenon {
  display: grid;
  gap: 2px;
  margin: 0 0 var(--space-3);
  padding: var(--space-3);
  border-left: 3px solid var(--color-accent);
  border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
  background: var(--color-warning-soft);
}
.phenomenon span,
.phenomenon p {
  color: var(--color-muted);
  font-size: 0.72rem;
}
.support-groups {
  display: grid;
  gap: var(--space-2);
}
.support-group {
  overflow: hidden;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  transition:
    border-color 160ms ease,
    box-shadow 160ms ease;
}
.support-group[open] {
  border-color: #b7cec3;
  box-shadow: var(--shadow-sm);
}
summary {
  min-height: 54px;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  cursor: pointer;
  list-style: none;
}
summary::-webkit-details-marker {
  display: none;
}
.group-icon {
  display: grid;
  width: 30px;
  height: 30px;
  flex: 0 0 auto;
  place-items: center;
  border-radius: 9px;
  color: var(--color-primary);
  background: var(--color-primary-soft);
  font-size: 0.72rem;
  font-weight: 800;
}
.strategy-group .group-icon {
  color: #805a18;
  background: #fff2d8;
}
.hint-group .group-icon {
  color: #435d83;
  background: #eaf1fb;
}
.group-label {
  flex: 1;
  font-size: 0.82rem;
  font-weight: 750;
}
.group-count {
  font-size: 1.15rem;
  line-height: 1;
}
.chevron {
  color: var(--color-muted);
  transition: transform 160ms ease;
}
.support-group[open] .chevron {
  transform: rotate(180deg);
}
.group-content {
  padding: 0 var(--space-3) var(--space-3);
  animation: reveal-content 160ms ease-out both;
}
ul {
  display: grid;
  gap: var(--space-2);
  margin: 0;
  padding: 0;
  list-style: none;
}
li {
  padding: var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: #fbfcfb;
  transition:
    border-color 160ms ease,
    background 160ms ease;
}
li.recommended {
  border-color: #e2a84a;
  background: #fff8e9;
  box-shadow: inset 3px 0 #d99427;
}
.item-meta {
  justify-content: space-between;
  gap: var(--space-2);
  margin-bottom: 2px;
}
.kind {
  color: var(--color-primary);
  font-size: 0.66rem;
}
.round-badge {
  padding: 0.18rem 0.42rem;
  border-radius: 999px;
  color: #83520b;
  background: #ffe6b2;
  font-size: 0.64rem;
  font-weight: 800;
}
li a {
  display: block;
  color: var(--color-primary);
  font-size: 0.8rem;
  font-weight: 750;
}
li p,
blockquote {
  margin: var(--space-1) 0 0;
  color: var(--color-muted);
  font-size: 0.72rem;
  line-height: 1.45;
}
.recommendation-reason {
  padding: var(--space-2);
  border-radius: var(--radius-sm);
  color: #74470a;
  background: rgb(255 230 178 / 55%);
}
blockquote {
  padding-left: var(--space-2);
  border-left: 2px solid var(--color-primary);
}
.hint-intro {
  margin: 0 0 var(--space-2);
  color: var(--color-muted);
  font-size: 0.7rem;
}
.hint {
  margin-top: var(--space-2);
  padding: var(--space-3);
  border: 1px dashed #b9c9c1;
  border-radius: var(--radius-sm);
  background: #f9fbfa;
}
.hint > div {
  justify-content: space-between;
  gap: var(--space-2);
}
.hint p {
  margin: var(--space-1) 0;
  color: var(--color-muted);
  font-size: 0.72rem;
}
.hint button {
  margin-top: var(--space-2);
  padding: 0;
  font-size: 0.74rem;
  font-weight: 750;
}
.hint button:disabled {
  opacity: 0.55;
}
.hint .used {
  color: var(--color-primary);
  font-size: 0.68rem;
  font-weight: 750;
}
@keyframes reveal-content {
  from {
    opacity: 0;
    transform: translateY(-3px);
  }
}
@media (prefers-reduced-motion: reduce) {
  .support-group,
  .chevron,
  .group-content,
  li {
    transition: none;
    animation: none;
  }
}
</style>
