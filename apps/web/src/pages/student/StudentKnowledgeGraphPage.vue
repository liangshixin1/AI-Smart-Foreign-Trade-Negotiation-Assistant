<!-- [组件导读]
业务名词：Attempt 是一次训练记录；学生负责练习，教师查看所属班级学情，技术人员维护平台运行配置。
用途：学生完整知识图谱页面，供浏览已发布的教学关系。
逻辑：useStudentKnowledgeGraph 负责加载，KnowledgeGraphExplorer 负责筛选和节点详情；学习入口指向学生内容页面。
结构：template 描述页面结构；script setup 声明输入、状态和事件；style 定义外观。
阅读线索：子组件 RoleWorkspaceLayout、KnowledgeGraphExplorer；状态入口 useStudentKnowledgeGraph。
为什么：把页面组合与数据处理分开，方便沿调用关系定位问题；页面显示成功需以实际请求结果为准。
[/组件导读] -->
<template>
  <RoleWorkspaceLayout title="谈判知识与策略地图">
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
