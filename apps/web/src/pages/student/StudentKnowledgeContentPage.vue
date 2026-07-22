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
      <RouterLink class="return" :to="returnTo">学完，返回训练 →</RouterLink>
    </article>
  </RoleWorkspaceLayout>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

import RoleWorkspaceLayout from '@/app/layouts/RoleWorkspaceLayout.vue'
import LearningMediaGallery from '@/features/knowledge-graph/components/LearningMediaGallery.vue'
import MarkdownLearningContent from '@/features/knowledge-graph/components/MarkdownLearningContent.vue'
import { useStudentLearningContent } from '@/features/knowledge-graph/composables/useLearningContent'

const route = useRoute()
const nodeId = computed(() => String(route.params.nodeId))
const returnTo = computed(() => String(route.query.returnTo || '/student/knowledge-graph'))
const { content, loading, error, reload } = useStudentLearningContent(nodeId.value)
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
  margin-top: var(--space-6);
}
.state {
  padding: var(--space-8);
  text-align: center;
}
.error {
  color: var(--color-danger);
}
</style>
