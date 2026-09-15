<!-- [组件导读]
业务名词：Attempt 是一次训练记录；学生负责练习，教师查看所属班级学情，技术人员维护平台运行配置。
用途：教师浏览教学图谱并维护节点显示短名的页面。
逻辑：useTeacherKnowledgeGraph 提供图谱读取、短名保存与恢复操作；浏览器组件发出的编辑事件接到这些操作并展示失败信息。
结构：template 描述页面结构；script setup 声明输入、状态和事件；style 定义外观。
阅读线索：子组件 RoleWorkspaceLayout；状态入口 useTeacherKnowledgeGraph。
为什么：把页面组合与数据处理分开，方便沿调用关系定位问题；页面显示成功需以实际请求结果为准。
[/组件导读] -->
<template>
  <RoleWorkspaceLayout
    title="教学知识图谱"
    description="围绕真实训练局面查看现象、知识资源与策略战术的连接；点击节点可追溯直接关联。"
  >
    <nav><RouterLink to="/teacher">← 返回班级总览</RouterLink></nav>
    <p v-if="loading" class="state">正在读取已发布的教学图谱…</p>
    <section v-else-if="error" class="state error" role="alert">
      <p>{{ error }}</p>
      <button type="button" @click="reload">重试</button>
    </section>
    <template v-else-if="graph">
      <header class="summary">
        <details class="version-info">
          <summary>图谱版本</summary>
          <span>{{ graph.graph_version }}</span>
        </details>
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
        editable-display
        :display-saving="displaySaving"
        :display-error="displayError"
        @save-display="updateNodeDisplay"
        @restore-display="restoreNodeDisplay"
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

const {
  graph,
  loading,
  error,
  displaySaving,
  displayError,
  reload,
  updateNodeDisplay,
  restoreNodeDisplay,
} = useTeacherKnowledgeGraph()
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
  flex-wrap: wrap;
  align-items: baseline;
  gap: var(--space-5);
  margin-bottom: var(--space-4);
  color: var(--color-muted);
  font-size: 0.8rem;
}
.summary strong {
  color: var(--color-ink);
}
.version-info {
  font-size: 12px;
}
.version-info span {
  display: block;
  max-width: 230px;
  padding-top: 6px;
}
</style>
