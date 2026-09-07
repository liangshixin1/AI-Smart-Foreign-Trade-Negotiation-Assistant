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
