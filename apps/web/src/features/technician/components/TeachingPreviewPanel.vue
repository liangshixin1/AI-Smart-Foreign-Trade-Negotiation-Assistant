<template>
  <section v-if="cases.length" class="preview" aria-labelledby="teaching-preview-title">
    <header>
      <div>
        <span class="eyebrow">教学语义预览</span>
        <h3 id="teaching-preview-title">先审教学链，再审图谱变更</h3>
      </div>
      <span>{{ cases.length }} 个案例</span>
    </header>
    <nav aria-label="案例选择">
      <button
        v-for="item in cases"
        :key="item.case_id"
        type="button"
        :class="{ active: item.case_id === selectedId }"
        @click="selectedId = item.case_id"
      >
        {{ item.case_id }}｜{{ item.title }}
      </button>
    </nav>
    <article v-if="selected" class="case-detail">
      <div class="case-heading">
        <div>
          <p>{{ selected.course_unit }} · {{ selected.training_mode }}</p>
          <h4>{{ selected.title }}</h4>
        </div>
        <span>{{ selected.rubrics.length }} 个评价维度</span>
      </div>
      <p class="task"><strong>学生任务：</strong>{{ selected.task }}</p>
      <div class="chain">
        <section>
          <h5>关键局面</h5>
          <ol>
            <li v-for="item in selected.situations" :key="item.situation_id">
              <strong>{{ item.situation_id }}｜{{ item.signal }}</strong>
              <p>期望识别：{{ item.recognition }}</p>
            </li>
          </ol>
        </section>
        <section>
          <h5>应对策略</h5>
          <ul>
            <li v-for="item in selected.strategies" :key="`${item.situation_id}-${item.name}`">
              <strong>{{ item.name }}</strong>
              <p>{{ item.action }}</p>
            </li>
          </ul>
        </section>
        <section>
          <h5>脚手架与知识</h5>
          <p>
            {{ selected.scaffolds.length }} 条分级提示 ·
            {{ selected.resources.length }} 项行动所需知识
          </p>
          <div class="chips">
            <span v-for="item in selected.resources" :key="`${item.type}-${item.title}`">
              {{ item.type }}｜{{ item.title }}
            </span>
          </div>
        </section>
        <section>
          <h5>评价与结果</h5>
          <div class="chips">
            <span v-for="item in selected.rubrics" :key="item.dimension">
              {{ item.dimension }} {{ item.weight }}%
            </span>
          </div>
          <p>
            {{ selected.outcomes.length }} 种条件化结果，其中
            {{ selected.outcomes.filter((item) => item.ideal).length }} 种理想结果。
          </p>
        </section>
      </div>
    </article>
  </section>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import type { TeachingCasePreview } from '@/features/technician/types/knowledgeGraph'

const props = defineProps<{ cases: TeachingCasePreview[] }>()
const selectedId = ref(props.cases[0]?.case_id ?? '')
const selected = computed(() => props.cases.find((item) => item.case_id === selectedId.value))
watch(
  () => props.cases,
  (value) => {
    if (!value.some((item) => item.case_id === selectedId.value)) {
      selectedId.value = value[0]?.case_id ?? ''
    }
  },
)
</script>

<style scoped>
.preview {
  display: grid;
  gap: var(--space-4);
  padding-top: var(--space-5);
  border-top: 1px solid var(--color-border);
}
header,
.case-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-3);
}
.eyebrow {
  color: var(--color-primary);
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.08em;
}
h3,
h4,
h5,
p {
  margin: 0;
}
nav {
  display: flex;
  gap: var(--space-2);
  overflow-x: auto;
  padding-bottom: var(--space-1);
}
button,
.chips span {
  border: 1px solid var(--color-border);
  border-radius: 999px;
  background: white;
}
button {
  flex: 0 0 auto;
  padding: 0.55rem 0.8rem;
  color: var(--color-muted);
}
button.active {
  color: white;
  border-color: var(--color-primary);
  background: var(--color-primary);
}
.case-detail {
  padding: var(--space-5);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: linear-gradient(145deg, #ffffff, #f7fbf9);
}
.case-heading p,
li p,
.chain > section > p {
  color: var(--color-muted);
}
.task {
  margin: var(--space-4) 0;
  padding: var(--space-3);
  border-left: 3px solid var(--color-primary);
  background: #edf7f2;
}
.chain {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-4);
}
.chain section {
  min-width: 0;
  padding-top: var(--space-3);
  border-top: 1px solid var(--color-border);
}
ol,
ul {
  display: grid;
  gap: var(--space-2);
  margin: var(--space-2) 0 0;
  padding-left: 1.2rem;
}
.chips {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  margin: var(--space-2) 0;
}
.chips span {
  padding: 0.35rem 0.6rem;
  font-size: 0.82rem;
}
@media (max-width: 760px) {
  .chain {
    grid-template-columns: 1fr;
  }
}
</style>
