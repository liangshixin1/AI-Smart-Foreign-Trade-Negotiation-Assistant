<template>
  <RoleWorkspaceLayout
    title="谈判知识与策略地图"
    description="从真实商务局面进入知识与策略；图谱不是答案库，而是训练前后可回访的学习路径。"
  >
    <nav><RouterLink to="/student">← 返回学习路线</RouterLink></nav>
    <p v-if="loading" class="state">正在读取已发布知识图谱…</p>
    <section v-else-if="error" class="state error" role="alert">
      <p>{{ error }}</p>
      <button type="button" @click="reload">重试</button>
    </section>
    <template v-else-if="graph">
      <header class="summary">
        <span>{{ graph.node_count }} 个现象／知识／策略节点</span>
        <span>{{ graph.edge_count }} 条教学联系</span>
      </header>
      <KnowledgeGraphExplorer :graph="graph" content-base="/student/knowledge/" />
    </template>
  </RoleWorkspaceLayout>
</template>

<script setup lang="ts">
import RoleWorkspaceLayout from '@/app/layouts/RoleWorkspaceLayout.vue'
import KnowledgeGraphExplorer from '@/features/knowledge-graph/components/KnowledgeGraphExplorer.vue'
import { useStudentKnowledgeGraph } from '@/features/knowledge-graph/composables/useStudentKnowledgeGraph'

const { graph, loading, error, reload } = useStudentKnowledgeGraph()
</script>

<style scoped>
nav,
.summary {
  margin-bottom: var(--space-4);
}
nav a {
  color: var(--color-primary);
  font-weight: 700;
}
.summary {
  display: flex;
  gap: var(--space-5);
  color: var(--color-muted);
  font-size: 0.82rem;
}
.state {
  padding: var(--space-8);
  text-align: center;
}
.error {
  color: var(--color-danger);
}
</style>
