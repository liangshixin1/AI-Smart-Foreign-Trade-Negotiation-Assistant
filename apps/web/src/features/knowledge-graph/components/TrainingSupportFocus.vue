<!-- [组件导读]
业务名词：图谱把业务阶段、商务现象、知识点和策略连成关系；Scaffold 是某次训练固定的学习支持库，overlay 是证据高亮层。
用途：将当前商务现象与本轮推荐知识并排呈现，形成聚焦的学习支持区。
逻辑：先按节点编号把 recommendations 与 nodes 配对；只有找到实际节点的推荐才显示，学习链接保留当前训练上下文。
结构：template 描述页面结构；script setup 声明输入、状态和事件；style 定义外观。
阅读线索：状态入口 useRoute。
为什么：把图谱事实、证据高亮和界面选择分开，便于按版本回放；颜色或浏览行为不能自动证明学生已经掌握。
[/组件导读] -->
<template>
  <section v-if="recommendations.length" class="focus" aria-label="本轮知识关系聚焦">
    <header><span>本轮关系聚焦</span><small>随对话更新</small></header>
    <div class="chain">
      <span class="phenomenon">{{ phenomenon?.short_label ?? '当前局面' }}</span>
      <i aria-hidden="true">→</i>
      <div>
        <RouterLink
          v-for="item in recommendedNodes"
          :key="item.node.id"
          :class="item.recommendation.node_type"
          :to="learningRoute(item.node.id)"
          :title="item.recommendation.reason"
        >
          {{ item.node.short_label }}
        </RouterLink>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

import type { GraphRecommendation } from '@/features/training/types'

import type { KnowledgeGraphNode } from '../types'

const route = useRoute()
const props = defineProps<{
  phenomenon: KnowledgeGraphNode | null
  nodes: KnowledgeGraphNode[]
  recommendations: GraphRecommendation[]
}>()

const recommendedNodes = computed(() => {
  const byId = new Map(props.nodes.map((node) => [node.id, node]))
  return props.recommendations.flatMap((recommendation) => {
    const node = byId.get(recommendation.node_id)
    return node ? [{ node, recommendation }] : []
  })
})

// [导读] 构造学习页地址，同时携带来源、返回位置及当前上下文；这样学习后可以回到原来的训练或评价。
function learningRoute(nodeId: string) {
  return {
    path: `/student/knowledge/${encodeURIComponent(nodeId)}`,
    query: {
      returnTo: route.fullPath,
      source: 'training',
      attemptId: String(route.params.attemptId),
    },
  }
}
</script>

<style scoped>
.focus {
  margin-bottom: var(--space-3);
  padding: var(--space-3);
  border: 1px solid #bcd8cc;
  border-radius: var(--radius-md);
  background: linear-gradient(135deg, #f4fbf7, #fffaf1);
}
header,
.chain,
.chain > div {
  display: flex;
  align-items: center;
}
header {
  justify-content: space-between;
  margin-bottom: var(--space-2);
  color: var(--color-primary);
  font-size: 0.72rem;
  font-weight: 800;
}
header small {
  color: var(--color-muted);
  font-weight: 600;
}
.chain {
  gap: var(--space-2);
}
.chain > div {
  flex-wrap: wrap;
  gap: 5px;
}
.chain i {
  color: var(--color-muted);
  font-style: normal;
}
.phenomenon,
a {
  padding: 0.3rem 0.5rem;
  border-radius: 999px;
  font-size: 0.72rem;
  font-weight: 750;
}
.phenomenon {
  color: #77500b;
  background: #fff0c9;
}
a {
  color: #17628a;
  background: #e8f5fc;
  text-decoration: none;
}
a.strategy {
  color: #17684e;
  background: #e1f4ec;
}
</style>
