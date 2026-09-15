<!-- [组件导读]
业务名词：Attempt 是一次训练；仿真用逐段台词和角色演出呈现谈判，态势是根据原话证据计算的状态。
用途：展示仿真谈判态势、里程碑与可展开的原话证据。
逻辑：读取后端给出的 state，统计已具备证据的里程碑并转换状态文案；重试分析通过 retry 事件由父组件执行。
结构：template 描述页面结构；script setup 声明输入、状态和事件；style 定义外观。
为什么：演出显示与已保存训练数据分开，浏览器动画不能充当消息保存或态势计算的成功回执。
[/组件导读] -->
<template>
  <section class="status-wrap" aria-label="本局谈判态势">
    <div class="metrics">
      <button type="button" @click="expanded = !expanded">
        <span>沟通信任</span><strong>{{ bandLabel(state.trust.band) }}</strong>
        <i><b :style="{ width: `${state.trust.value}%` }"></b></i>
      </button>
      <button type="button" @click="expanded = !expanded">
        <span>合作意愿</span><strong>{{ bandLabel(state.willingness.band) }}</strong>
        <i><b :style="{ width: `${state.willingness.value}%` }"></b></i>
      </button>
      <button type="button" @click="expanded = !expanded">
        <span>条款共识</span
        ><strong>{{ state.alignment.confirmed }}/{{ state.alignment.required }}</strong>
        <i><b :style="{ width: `${state.alignment.value}%` }"></b></i>
      </button>
      <div class="milestone">
        <span>本节目标</span><strong>{{ evidenced }}/{{ state.milestones.length }}</strong>
      </div>
    </div>
    <div v-if="expanded" class="details">
      <p>这些数值只描述本局公开互动，不是人格、好感或正式成绩。</p>
      <p v-if="state.analysis_status === 'pending'">本轮反馈正在整理，当前显示上一份已确认态势。</p>
      <p v-else-if="state.analysis_status === 'failed'" class="warning">
        本轮态势暂未更新，已确认台词不受影响。
      </p>
      <ul v-if="state.public_changes.length">
        <li v-for="change in state.public_changes" :key="change.event_id">
          <strong>{{ change.label }}</strong
          >：{{ change.reason }}
          <blockquote v-for="item in change.evidence" :key="item.message_id">
            “{{ item.quote }}”
          </blockquote>
        </li>
      </ul>
      <p v-else>尚无新的可确认变化。</p>
      <button
        v-if="state.analysis_status === 'failed'"
        type="button"
        :disabled="retrying"
        @click="$emit('retry')"
      >
        {{ retrying ? '重试中…' : '重试本轮态势分析' }}
      </button>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import type { SimulationState } from '../types'

const props = defineProps<{ state: SimulationState; retrying: boolean }>()
defineEmits<{ retry: [] }>()
const expanded = ref(false)
const evidenced = computed(
  () => props.state.milestones.filter((item) => item.status === 'evidenced').length,
)
// [导读] 将谨慎、平稳和积极三个后端状态转换为中文。
function bandLabel(band: 'cautious' | 'steady' | 'positive'): string {
  return { cautious: '谨慎', steady: '平稳', positive: '积极' }[band]
}
</script>

<style scoped>
.status-wrap {
  border-bottom: 1px solid var(--color-border);
  background: rgba(255, 255, 255, 0.96);
}
.metrics {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 1px;
}
.metrics > button,
.milestone {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 5px 10px;
  min-width: 0;
  padding: 10px 14px;
  border: 0;
  color: var(--color-text);
  background: transparent;
  text-align: left;
}
.metrics span {
  color: var(--color-muted);
  font-size: 0.72rem;
}
.metrics strong {
  font-size: 0.8rem;
}
i {
  grid-column: 1 / 3;
  height: 4px;
  overflow: hidden;
  border-radius: 99px;
  background: #e3e9e6;
}
i b {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--color-primary);
  transition: width 240ms ease;
}
.details {
  position: absolute;
  z-index: 8;
  right: 12px;
  width: min(520px, calc(100vw - 24px));
  padding: 14px 16px;
  border: 1px solid var(--color-border);
  border-radius: 12px;
  background: white;
  box-shadow: 0 16px 40px rgba(16, 37, 31, 0.18);
}
.details p {
  margin: 0 0 8px;
  color: var(--color-muted);
  font-size: 0.8rem;
  line-height: 1.5;
}
.details ul {
  margin: 8px 0;
  padding-left: 20px;
  font-size: 0.82rem;
}
.details blockquote {
  margin: 5px 0 0;
  padding-left: 9px;
  border-left: 2px solid var(--color-border);
  color: var(--color-muted);
  overflow-wrap: anywhere;
}
.details button {
  min-height: 34px;
  border: 0;
  border-radius: 8px;
  color: white;
  background: var(--color-primary);
}
.warning {
  color: var(--color-danger) !important;
}
@media (max-width: 700px) {
  .metrics {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
  .milestone {
    display: none;
  }
  .metrics > button {
    padding: 8px;
  }
  .metrics strong {
    font-size: 0.72rem;
  }
}
@media (prefers-reduced-motion: reduce) {
  i b {
    transition: none;
  }
}
</style>
