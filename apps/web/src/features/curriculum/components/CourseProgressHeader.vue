<template>
  <section class="progress" aria-label="课程进度">
    <div>
      <p>当前课程</p>
      <h2>{{ courseTitle }}</h2>
    </div>
    <div class="numbers">
      <strong>{{ completionRate }}%</strong>
      <span>{{ completedUnits }} / {{ totalUnits }} 小节已完成</span>
    </div>
    <div
      class="progress-track"
      role="progressbar"
      :aria-valuenow="completionRate"
      aria-valuemin="0"
      aria-valuemax="100"
    >
      <i :style="{ width: `${completionRate}%` }"></i>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{ courseTitle: string; completedUnits: number; totalUnits: number }>()
const completionRate = computed(() =>
  props.totalUnits ? Math.round((props.completedUnits / props.totalUnits) * 100) : 0,
)
</script>

<style scoped>
.progress {
  position: relative;
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: var(--space-6);
  padding: var(--space-2) 0 var(--space-8);
  border-bottom: 1px solid var(--color-border);
}

p,
h2,
.numbers span {
  margin: 0;
}

p,
.numbers span {
  color: var(--color-muted);
  font-size: 0.9rem;
}

h2 {
  margin-top: var(--space-1);
}

.numbers {
  display: grid;
  text-align: right;
}

.numbers strong {
  color: var(--color-primary);
  font-size: 1.5rem;
}
.progress-track {
  position: absolute;
  right: 0;
  bottom: -1px;
  left: 0;
  height: 4px;
  overflow: hidden;
  border-radius: 999px;
  background: #e7ede9;
}
.progress-track i {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, var(--color-primary), #4ca67f);
  transition: width 420ms ease;
}
</style>
