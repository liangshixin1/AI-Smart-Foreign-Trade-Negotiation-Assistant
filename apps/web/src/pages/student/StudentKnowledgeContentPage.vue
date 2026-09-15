<!-- [组件导读]
业务名词：Attempt 是一次训练记录；学生负责练习，教师查看所属班级学情，技术人员维护平台运行配置。
用途：学生节点学习页，展示正文、视频、PPTX、节点位置与学习完成入口。
逻辑：从路由读取 nodeId、来源和关联训练；useStudentLearningContent 加载内容，useLearningActivity 记录浏览和完成事件，返回地址保留学习路径。
结构：template 描述页面结构；script setup 声明输入、状态和事件；style 定义外观。
阅读线索：子组件 RoleWorkspaceLayout、LearningMediaGallery、MarkdownLearningContent、KnowledgeNodeContextGraph；状态入口 useRoute、useStudentLearningContent、useLearningActivity。
为什么：学习入口可能来自地图、训练或评价，携带来源和返回位置才能保留完整学习路径。
[/组件导读] -->
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
        <span>{{ contentTypeLabel }}</span>
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
const { content, loading, error, reload } = useStudentLearningContent(nodeId)
const contentTypeLabel = computed(() => {
  const labels: Record<string, string> = {
    Stage: '阶段',
    Phenomenon: '现象',
    KnowledgePoint: '知识点',
    NegotiationStrategy: '谈判策略',
  }
  return labels[content.value?.node_type || ''] || '知识资源'
})
const {
  completing,
  completed,
  message: activityMessage,
  record,
} = useLearningActivity(nodeId, source, attemptId)

watch(content, (value) => {
  if (value) void record('viewed')
})
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
