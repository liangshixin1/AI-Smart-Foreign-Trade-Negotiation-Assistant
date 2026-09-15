<!-- [组件导读]
业务名词：Attempt 是一次训练记录；学生负责练习，教师查看所属班级学情，技术人员维护平台运行配置。
用途：开始训练前展示小节目标、规则，并让学生选择难度和支持的体验方式。
逻辑：useUnitDetail 读取小节，useStartAttempt 创建训练；若当前小节不支持选中的体验方式，监听器将其切回文字模式。
结构：template 描述页面结构；script setup 声明输入、状态和事件；style 定义外观。
阅读线索：子组件 RoleWorkspaceLayout；状态入口 useUnitDetail、useRoute、useStartAttempt。
为什么：把页面组合与数据处理分开，方便沿调用关系定位问题；页面显示成功需以实际请求结果为准。
[/组件导读] -->
<template>
  <RoleWorkspaceLayout title="训练准备" description="开始前先确认目标、任务模式和评价方式。">
    <p v-if="loading">正在加载小节…</p>
    <p v-else-if="error" role="alert">{{ error }}</p>
    <article v-else-if="unit" class="preparation">
      <header>
        <div>
          <p>{{ modeLabel }} · 约 {{ unit.estimated_minutes }} 分钟</p>
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
        <template v-if="unit.workspace_kind === 'lc_correction'"
          ><h3>信用证审改模式 · 通关规则</h3>
          <p>本证含8处不符点。原证保持只读，提交的是改证申请草案。</p>
          <p>
            定位30%、修改50%、依据20%；误报每项扣3分，错误修改正确重大字段额外扣5分，总扣分最多15分。
          </p>
          <p>总分至少80分、无重大遗漏、未错误修改正确重大字段且全部已提交项结构完整，才判通过。</p>
          <p v-if="!unit.document_correction_enabled">
            信用证审改模式尚未开放，请联系教师。
          </p></template
        >
        <h3 v-else>评价维度</h3>
        <ul v-if="unit.workspace_kind !== 'lc_correction'">
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
      <fieldset v-if="unit.supported_experience_modes.length > 1" class="mode-picker">
        <legend>体验方式</legend>
        <label
          v-for="option in experienceOptions"
          :key="option.value"
          :class="{ selected: experienceMode === option.value }"
        >
          <input v-model="experienceMode" type="radio" :value="option.value" />
          <span>
            <strong>{{ option.label }}</strong>
            <small>{{ option.description }}</small>
          </span>
        </label>
      </fieldset>
      <p v-if="startError" role="alert">{{ startError }}</p>
      <p v-if="unit.status === 'locked'" class="locked-note">
        该小节尚未解锁，请回到路线完成前置训练。
      </p>
      <button
        type="button"
        :disabled="
          starting ||
          unit.status === 'locked' ||
          (unit.workspace_kind === 'lc_correction' && !unit.document_correction_enabled)
        "
        @click="start(difficulty, experienceMode)"
      >
        {{ starting ? '正在生成实战场景…' : startLabel }}
      </button>
    </article>
  </RoleWorkspaceLayout>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'

import RoleWorkspaceLayout from '@/app/layouts/RoleWorkspaceLayout.vue'
import { useUnitDetail } from '@/features/curriculum/composables/useUnitDetail'
import { useStartAttempt } from '@/features/training/composables/useStartAttempt'

const { unit, loading, error } = useUnitDetail()
const route = useRoute()
const difficulty = ref('standard')
const experienceMode = ref<'chat' | 'simulation'>('chat')
const experienceOptions = [
  { value: 'chat', label: '对话模式', description: '沿用文字工作台，适合连续长对话。' },
  {
    value: 'simulation',
    label: '仿真模式',
    description: '情境演出、简短交锋与可追溯谈判态势。',
  },
] as const
const modeLabels: Record<string, string> = {
  negotiation: '实战谈判',
  business_email: '商务邮件',
  document_review: '单证审阅',
}
const modeLabel = computed(() =>
  unit.value?.workspace_kind === 'lc_correction'
    ? '信用证审改模式'
    : (modeLabels[unit.value?.training_mode ?? ''] ?? '实战训练'),
)
const startLabel = computed(() =>
  unit.value?.workspace_kind === 'lc_correction'
    ? '进入信用证审改工作台'
    : experienceMode.value === 'simulation'
      ? '进入情境演出'
      : '生成场景并进入局面简报',
)
const { start, starting, startError } = useStartAttempt(String(route.params.unitId))
watch(unit, (next) => {
  if (next && !next.supported_experience_modes.includes(experienceMode.value)) {
    experienceMode.value = 'chat'
  }
})
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
.mode-picker {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-3);
  margin: 0;
  padding: 0;
  border: 0;
}
.mode-picker legend {
  margin-bottom: var(--space-2);
  font-weight: 700;
}
.mode-picker label {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
  max-width: none;
  padding: var(--space-4);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  cursor: pointer;
}
.mode-picker label.selected {
  border-color: var(--color-primary);
  background: var(--color-primary-soft);
}
.mode-picker input {
  margin-top: 3px;
}
.mode-picker span {
  display: grid;
  gap: 4px;
}
.mode-picker small {
  color: var(--color-muted);
  line-height: 1.45;
}
select {
  min-height: 42px;
  padding: 0 var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-surface);
}
header {
  padding: 24px;
  border-radius: var(--radius-md);
  background: var(--color-primary-soft);
}
header p {
  font-size: 12px;
  margin-bottom: 8px;
  color: var(--color-primary);
}
header span {
  flex-shrink: 0;
  font-size: 12px;
}
section {
  padding-bottom: 20px;
  border-bottom: 1px solid var(--color-border);
}
li + li {
  margin-top: 8px;
}
@media (max-width: 640px) {
  header {
    padding: 20px;
    flex-direction: column;
    gap: 12px;
  }
  header h2 {
    font-size: 20px;
  }
  .mode-picker {
    grid-template-columns: 1fr;
  }
}
</style>
