<template>
  <section class="evidence" aria-labelledby="graph-evidence-title">
    <header>
      <div>
        <p>知识图谱证据链</p>
        <h2 id="graph-evidence-title">脚手架依赖与每轮学习证据</h2>
      </div>
      <span>{{ evidence.length }} 轮映射</span>
    </header>
    <div class="usage">
      <strong>提示依赖</strong>
      <span>展开 {{ revealCount }} 次</span>
      <span>采用 {{ useCount }} 次</span>
      <span v-if="interactions[0]">版本 {{ interactions[0].graph_version }}</span>
    </div>
    <p v-if="!interactions.length && !evidence.length" class="empty">
      本次训练没有使用图谱脚手架，也尚未形成图谱学习证据。
    </p>
    <ol v-else>
      <li v-for="item in evidence" :key="item.id">
        <div>
          <strong>本轮 {{ item.score }} 分</strong><span>{{ formatTime(item.created_at) }}</span>
        </div>
        <p>{{ item.evidence_summary }}</p>
        <div class="node-chain">
          <div v-if="item.phenomenon_node_keys.length">
            <span>现象</span>
            <b v-for="nodeId in item.phenomenon_node_keys" :key="nodeId">
              {{ labelFor(item, nodeId) }}
            </b>
          </div>
          <div v-if="item.knowledge_resource_node_keys.length">
            <span>知识</span>
            <RouterLink
              v-for="nodeId in item.knowledge_resource_node_keys"
              :key="nodeId"
              :to="contentRoute(nodeId)"
            >
              {{ labelFor(item, nodeId) }}
            </RouterLink>
          </div>
          <div v-if="item.strategy_node_keys.length">
            <span>策略</span>
            <RouterLink
              v-for="nodeId in item.strategy_node_keys"
              :key="nodeId"
              :to="contentRoute(nodeId)"
            >
              {{ labelFor(item, nodeId) }}
            </RouterLink>
          </div>
        </div>
      </li>
    </ol>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import type {
  GraphLearningEvidence,
  ScaffoldInteraction,
} from '@/features/teacher-dashboard/api/teacherApi'

const props = defineProps<{
  interactions: ScaffoldInteraction[]
  evidence: GraphLearningEvidence[]
}>()
const revealCount = computed(
  () => props.interactions.filter((item) => item.event_type === 'revealed').length,
)
const useCount = computed(
  () => props.interactions.filter((item) => item.event_type === 'used').length,
)
function formatTime(value: string): string {
  return new Date(value).toLocaleString('zh-CN')
}
function labelFor(item: GraphLearningEvidence, nodeId: string): string {
  return item.node_labels[nodeId] ?? nodeId
}
function contentRoute(nodeId: string): string {
  return `/teacher/knowledge-content/${encodeURIComponent(nodeId)}`
}
</script>

<style scoped>
.evidence {
  margin-top: var(--space-6);
  padding: var(--space-5);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: #fafcfb;
}
header,
header > div,
.usage,
li > div {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}
header {
  justify-content: space-between;
}
header > div {
  align-items: flex-start;
  flex-direction: column;
  gap: 1px;
}
header p,
header h2,
li p {
  margin: 0;
}
header p {
  color: var(--color-primary);
  font-size: 0.72rem;
  font-weight: 800;
}
header h2 {
  font-size: 1.05rem;
}
header span,
.usage span,
li span,
.empty {
  color: var(--color-muted);
  font-size: 0.76rem;
}
.usage {
  margin: var(--space-4) 0;
  padding: var(--space-3);
  border-radius: var(--radius-sm);
  background: var(--color-primary-soft);
  font-size: 0.8rem;
}
ol {
  display: grid;
  gap: var(--space-2);
  margin: 0;
  padding: 0;
  list-style: none;
}
li {
  padding: var(--space-3);
  border-left: 3px solid var(--color-primary);
  background: var(--color-surface);
}
li > div {
  justify-content: space-between;
}
li p {
  margin-top: var(--space-1);
  color: var(--color-muted);
  font-size: 0.78rem;
}
.node-chain {
  display: grid;
  gap: var(--space-2);
  margin: var(--space-2) 0 0;
}
.node-chain div {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 3px;
  font-size: 0.7rem;
}
.node-chain span {
  color: var(--color-muted);
}
.node-chain b,
.node-chain a {
  padding: 3px 6px;
  border-radius: 999px;
  color: var(--color-primary);
  background: var(--color-primary-soft);
  font-weight: 700;
  text-decoration: none;
}
</style>
