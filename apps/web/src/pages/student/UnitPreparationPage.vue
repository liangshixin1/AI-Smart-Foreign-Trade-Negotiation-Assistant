<template>
  <RoleWorkspaceLayout title="训练准备" description="开始前先确认目标、任务模式和评价方式。">
    <p v-if="loading">正在加载小节…</p>
    <p v-else-if="error" role="alert">{{ error }}</p>
    <article v-else-if="unit" class="preparation">
      <header>
        <div>
          <p>{{ unit.training_mode }} · 约 {{ unit.estimated_minutes }} 分钟</p>
          <h2>{{ unit.title }}</h2>
        </div>
        <span>{{ unit.status === 'available' ? '可开始' : '需先完成前置小节' }}</span>
      </header>
      <p>{{ unit.description }}</p>
      <section>
        <h3>本节目标</h3>
        <ul>
          <li v-for="objective in unit.learning_objectives" :key="objective">{{ objective }}</li>
        </ul>
      </section>
      <section>
        <h3>评价维度</h3>
        <ul>
          <li v-for="dimension in unit.rubric_dimensions" :key="dimension.key">
            {{ dimension.label }}（{{ Math.round(dimension.weight * 100) }}%）
          </li>
        </ul>
      </section>
      <label>
        训练难度
        <select v-model="difficulty">
          <option v-for="option in unit.difficulty_options" :key="option" :value="option">
            {{ option === 'standard' ? '标准' : option }}
          </option>
        </select>
      </label>
      <p v-if="startError" role="alert">{{ startError }}</p>
      <p v-if="unit.status === 'locked'" class="locked-note">
        该小节尚未解锁，请回到路线完成前置训练。
      </p>
      <button
        type="button"
        :disabled="starting || unit.status === 'locked'"
        @click="start(difficulty)"
      >
        {{ starting ? '正在生成实战场景…' : '开始训练' }}
      </button>
    </article>
  </RoleWorkspaceLayout>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRoute } from 'vue-router'

import RoleWorkspaceLayout from '@/app/layouts/RoleWorkspaceLayout.vue'
import { useUnitDetail } from '@/features/curriculum/composables/useUnitDetail'
import { useStartAttempt } from '@/features/training/composables/useStartAttempt'

const { unit, loading, error } = useUnitDetail()
const route = useRoute()
const difficulty = ref('standard')
const { start, starting, startError } = useStartAttempt(String(route.params.unitId))
</script>

<style scoped>
.preparation {
  display: grid;
  gap: var(--space-6);
}
header {
  display: flex;
  justify-content: space-between;
  gap: var(--space-6);
}
h2,
h3,
p {
  margin: 0;
}
header p,
header span {
  color: var(--color-muted);
}
.locked-note {
  color: var(--color-danger);
}
ul {
  margin: var(--space-2) 0 0;
  padding-left: var(--space-6);
}
button {
  min-height: 44px;
  border: 0;
  border-radius: var(--radius-sm);
  color: white;
  background: var(--color-primary);
}
button:disabled {
  opacity: 0.55;
}
label {
  display: grid;
  gap: var(--space-2);
  max-width: 240px;
}
select {
  min-height: 42px;
  padding: 0 var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-surface);
}
</style>
