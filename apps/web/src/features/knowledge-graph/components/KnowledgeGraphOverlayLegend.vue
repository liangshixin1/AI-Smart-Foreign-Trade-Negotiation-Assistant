<!-- [组件导读]
业务名词：图谱把业务阶段、商务现象、知识点和策略连成关系；Scaffold 是某次训练固定的学习支持库，overlay 是证据高亮层。
用途：说明知识图中的颜色和标记含义。
逻辑：依据 audience 区分教师与学生文案，依据 phase 区分回放等使用场景；这些标记的实际计算在 graphOverlay 等模块完成。
结构：template 描述页面结构；script setup 声明输入、状态和事件；style 定义外观。
为什么：把图谱事实、证据高亮和界面选择分开，便于按版本回放；颜色或浏览行为不能自动证明学生已经掌握。
[/组件导读] -->
<template>
  <div class="legend" :aria-label="audience === 'teacher' ? '教师图谱图例' : '学生图谱图例'">
    <template v-if="phase === 'briefing'">
      <span><i class="current" />本场重点</span>
      <span><i class="review" />既往关注</span>
      <span><i />完整流程背景</span>
    </template>
    <template v-else-if="phase === 'compass'">
      <span><i class="current" />本轮位置</span>
      <span><i class="encountered" />此前轨迹</span>
      <span><i />未展开节点</span>
    </template>
    <template v-else-if="phase === 'replay'">
      <span><i class="current" />当前轮次</span>
      <span><i class="encountered" />此前轨迹</span>
      <span><i />完整知识背景</span>
    </template>
    <template v-else-if="audience === 'student'">
      <span><i class="encountered" />已遇见</span>
      <span><i class="developing" />正在形成</span>
      <span><i class="stable" />表现稳定</span>
      <span><i class="review" />建议巩固</span>
    </template>
    <template v-else>
      <span><i class="low" />低于 70</span>
      <span><i class="medium" />70–81</span>
      <span><i class="high" />82 以上</span>
      <span><i class="current" />当前分析重点</span>
    </template>
  </div>
</template>

<script setup lang="ts">
import type { GraphDisplayPhase, GraphOverlayAudience } from '../graphOverlay'

defineProps<{ audience: GraphOverlayAudience; phase?: GraphDisplayPhase | undefined }>()
</script>

<style scoped>
.legend {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.45rem 0.85rem;
  color: var(--color-muted);
  font-size: 0.7rem;
}
.legend span {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
}
.legend i {
  width: 10px;
  height: 10px;
  border: 2px solid #9aa9a3;
  border-radius: 50%;
  background: #fff;
}
.legend .encountered {
  border-color: #4f91b5;
}
.legend .developing,
.legend .medium {
  border-color: #d39a31;
  background: #d8a64d;
}
.legend .stable,
.legend .high {
  border-color: #1d805f;
  background: #3c9475;
}
.legend .review,
.legend .low {
  border-color: #9e463f;
  background: #c66d63;
}
.legend .current {
  border-color: #f1a72c;
  border-width: 3px;
}
</style>
