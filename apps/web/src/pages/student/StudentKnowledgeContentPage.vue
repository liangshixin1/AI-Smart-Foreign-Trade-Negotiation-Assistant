<template>
  <RoleWorkspaceLayout title="学习补给" description="读完可以回到原训练位置继续谈判。">
    <nav><RouterLink :to="returnTo">← 返回上一学习位置</RouterLink></nav>
    <p v-if="loading" class="state">正在加载学习内容…</p>
    <section v-else-if="error" class="state error" role="alert">
      <p>{{ error }}</p>
      <button type="button" @click="reload">重试</button>
    </section>
    <article v-else-if="content" class="lesson">
      <header>
        <span>{{ content.node_type === 'NegotiationStrategy' ? '谈判策略' : '知识资源' }}</span>
        <h1>{{ content.title }}</h1>
        <p>{{ content.summary }}</p>
      </header>
      <LearningMediaGallery
        :node-id="content.node_id"
        :assets="content.assets"
        audience="student"
      />
      <MarkdownLearningContent :source="content.markdown_body" />
      <KnowledgeNodeContextGraph :node-id="content.node_id" audience="student" />
      <footer class="learning-actions">
        <div>
          <button type="button" :disabled="completing || completed" @click="record('completed')">
            {{ completed ? '已完成学习' : completing ? '正在记录…' : '标记为已学习' }}
          </button>
          <p v-if="activityMessage" role="status">{{ activityMessage }}</p>
        </div>
        <RouterLink class="return" :to="returnTo">返回上一学习位置 →</RouterLink>
      </footer>
    </article>
  </RoleWorkspaceLayout>
</template>

<script setup lang="ts">
import { computed, watch } from 'vue'
import { useRoute } from 'vue-router'

import RoleWorkspaceLayout from '@/app/layouts/RoleWorkspaceLayout.vue'
import LearningMediaGallery from '@/features/knowledge-graph/components/LearningMediaGallery.vue'
import MarkdownLearningContent from '@/features/knowledge-graph/components/MarkdownLearningContent.vue'
import KnowledgeNodeContextGraph from '@/features/knowledge-graph/components/KnowledgeNodeContextGraph.vue'
import { useLearningActivity } from '@/features/knowledge-graph/composables/useLearningActivity'
import { useStudentLearningContent } from '@/features/knowledge-graph/composables/useLearningContent'
import type { LearningActivitySource } from '@/features/knowledge-graph/types'

const route = useRoute()
const nodeId = computed(() => String(route.params.nodeId))
const returnTo = computed(() => String(route.query.returnTo || '/student/knowledge-graph'))
const source = computed<LearningActivitySource>(() => {
  const value = String(route.query.source || 'map')
  return ['map', 'training', 'evaluation', 'profile'].includes(value)
    ? (value as LearningActivitySource)
    : 'map'
})
const attemptId = computed(() =>
  typeof route.query.attemptId === 'string' ? route.query.attemptId : null,
)
const { content, loading, error, reload } = useStudentLearningContent(nodeId.value)
const {
  completing,
  completed,
  message: activityMessage,
  record,
} = useLearningActivity(nodeId.value, source.value, attemptId.value)

watch(
  content,
  (value) => {
    if (value) void record('viewed')
  },
  { once: true },
)
</script>

<style scoped>
nav a,
.return {
  color: var(--color-primary);
  font-weight: 750;
}
.lesson {
  margin-top: var(--space-5);
  padding: clamp(1rem, 3vw, 2.5rem);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
}
.lesson header span {
  color: var(--color-primary);
  font-size: 0.75rem;
  font-weight: 800;
}
.lesson h1 {
  margin: var(--space-2) 0;
}
.lesson header p {
  max-width: 76ch;
  color: var(--color-muted);
}
.return {
  display: inline-flex;
}
.learning-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
  margin-top: var(--space-6);
  padding-top: var(--space-4);
  border-top: 1px solid var(--color-border);
}
.learning-actions button {
  min-height: 42px;
  padding: 0 var(--space-4);
  border: 0;
  border-radius: var(--radius-sm);
  color: white;
  background: var(--color-primary);
  cursor: pointer;
}
.learning-actions button:disabled {
  cursor: default;
  opacity: 0.65;
}
.learning-actions p {
  margin: var(--space-2) 0 0;
  color: var(--color-primary);
  font-size: 0.8rem;
}
.state {
  padding: var(--space-8);
  text-align: center;
}
.error {
  color: var(--color-danger);
}
</style>
