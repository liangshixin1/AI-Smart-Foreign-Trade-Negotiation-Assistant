<template>
  <RoleWorkspaceLayout
    title="教学知识图谱"
    description="围绕真实训练局面查看现象、知识资源与策略战术的连接；点击节点可追溯直接关联。"
  >
    <nav><RouterLink to="/teacher">← 返回班级总览</RouterLink></nav>
    <p v-if="loading" class="state">正在从 Neo4j 读取已发布图谱…</p>
    <section v-else-if="error" class="state error" role="alert">
      <p>{{ error }}</p>
      <button type="button" @click="reload">重试</button>
    </section>
    <template v-else-if="graph">
      <header class="summary">
        <span
          >图谱版本 <strong>{{ graph.graph_version }}</strong></span
        >
        <span
          ><strong>{{ graph.node_count }}</strong> 个节点</span
        >
        <span
          ><strong>{{ graph.edge_count }}</strong> 条联系</span
        >
      </header>
      <KnowledgeGraphExplorer
        :graph="graph"
        content-base="/teacher/knowledge-content/"
        content-action-label="编辑教学内容"
      />
    </template>
  </RoleWorkspaceLayout>
</template>

<script setup lang="ts">
import RoleWorkspaceLayout from '@/app/layouts/RoleWorkspaceLayout.vue'
import {
  KnowledgeGraphExplorer,
  useTeacherKnowledgeGraph,
} from '@/features/knowledge-graph/teacherGraph'

const { graph, loading, error, reload } = useTeacherKnowledgeGraph()
</script>

<style scoped>
nav {
  margin-bottom: var(--space-4);
}
nav a {
  color: var(--color-primary);
  font-weight: 700;
}
.state {
  padding: var(--space-8);
  color: var(--color-muted);
  text-align: center;
}
.error {
  color: var(--color-danger);
}
.summary {
  display: flex;
  gap: var(--space-5);
  margin-bottom: var(--space-4);
  color: var(--color-muted);
  font-size: 0.8rem;
}
.summary strong {
  color: var(--color-ink);
}
</style>
