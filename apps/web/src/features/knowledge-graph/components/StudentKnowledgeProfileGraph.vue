<!-- [组件导读]
业务名词：图谱把业务阶段、商务现象、知识点和策略连成关系；Scaffold 是某次训练固定的学习支持库，overlay 是证据高亮层。
用途：把学生累计学习与训练证据叠加到知识图上。
逻辑：图谱由 useStudentKnowledgeGraph 加载，insightOverlay 生成学生视角高亮；无底图时使用空图保持数据结构完整。
结构：template 描述页面结构；script setup 声明输入、状态和事件；style 定义外观。
阅读线索：子组件 KnowledgeGraphPhaseView；状态入口 useStudentKnowledgeGraph。
为什么：把图谱事实、证据高亮和界面选择分开，便于按版本回放；颜色或浏览行为不能自动证明学生已经掌握。
[/组件导读] -->
<template>
  <div class="profile-graph">
    <p v-if="loading" class="state">正在生成你的知识状态图…</p>
    <p v-else-if="error" class="state error" role="alert">
      {{ error }} <button type="button" @click="reload">重试</button>
    </p>
    <KnowledgeGraphPhaseView
      v-else-if="graph"
      :graph="graph"
      :overlay="overlay"
      eyebrow="我的知识地图"
      title="从训练证据看当前学习位置"
      description="外圈表示基于训练证据的学习状态；完成学习资源不等同于已经掌握。"
      content-base="/student/knowledge/"
      empty-text="完成一轮训练或打开学习资源后，这里会形成你的个人知识路径。"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import { insightOverlay } from '../graphOverlay'
import { useStudentKnowledgeGraph } from '../composables/useStudentKnowledgeGraph'
import type { KnowledgeInsights } from '../types'
import KnowledgeGraphPhaseView from './KnowledgeGraphPhaseView.vue'

const props = defineProps<{ insights: KnowledgeInsights }>()
const { graph, loading, error, reload } = useStudentKnowledgeGraph()
const overlay = computed(() =>
  insightOverlay(graph.value ?? emptyGraph(), props.insights, 'student'),
)

// [导读] 提供节点和连线均为空的合法图结构，让加载完成前的派生计算也能安全读取这些字段。
function emptyGraph() {
  return {
    graph_version: props.insights.graph_version,
    nodes: [],
    edges: [],
    node_count: 0,
    edge_count: 0,
  }
}
</script>

<style scoped>
.profile-graph {
  margin-top: var(--space-4);
}
.state {
  color: var(--color-muted);
}
.state button {
  border: 0;
  color: var(--color-primary);
  background: transparent;
  cursor: pointer;
}
.error {
  color: var(--color-danger);
}
</style>
