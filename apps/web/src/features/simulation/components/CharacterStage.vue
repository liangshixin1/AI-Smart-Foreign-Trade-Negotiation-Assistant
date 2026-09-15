<!-- [组件导读]
业务名词：Attempt 是一次训练；仿真用逐段台词和角色演出呈现谈判，态势是根据原话证据计算的状态。
用途：显示仿真场景背景及与角色表情、动作对应的立绘。
逻辑：图片地址来自 useSimulationAssets；表情图加载失败先退回 neutral，仍失败再显示替代内容，表情变化会重置失败状态。
结构：template 描述页面结构；script setup 声明输入、状态和事件；style 定义外观。
阅读线索：状态入口 useSimulationAssets。
为什么：演出显示与已保存训练数据分开，浏览器动画不能充当消息保存或态势计算的成功回执。
[/组件导读] -->
<template>
  <section class="stage" :class="`action-${action}`" aria-label="商务会谈场景">
    <img
      v-if="!backgroundFailed"
      class="background"
      :src="assets.background"
      alt=""
      @error="backgroundFailed = true"
    />
    <div class="vignette" aria-hidden="true"></div>
    <img
      v-if="!portraitFailed"
      :key="portraitUrl"
      class="portrait"
      :src="portraitUrl"
      :alt="`${displayName}，${expressionLabel}`"
      @error="handlePortraitError"
    />
    <div v-else class="portrait-fallback" role="img" :aria-label="`${displayName} 的中性占位形象`">
      <span aria-hidden="true">DL</span>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import { useSimulationAssets } from '../composables/useSimulationAssets'
import type { SimulationAction, SimulationExpression } from '../types'

const props = defineProps<{
  displayName: string
  expression: SimulationExpression
  action: SimulationAction
}>()
const assets = useSimulationAssets()
const backgroundFailed = ref(false)
const portraitFailed = ref(false)
const selectedExpression = ref<SimulationExpression>(props.expression)
const portraitUrl = computed(() => assets.portrait(selectedExpression.value))
const labels: Record<SimulationExpression, string> = {
  neutral: '平静神情',
  thinking: '思考神情',
  pleased: '认可神情',
  frustrated: '克制的不悦神情',
  confused: '疑惑神情',
}
const expressionLabel = computed(() => labels[selectedExpression.value])

// [导读] 非默认表情失败时先尝试默认立绘；默认图也失败才进入图片替代状态。
function handlePortraitError(): void {
  if (selectedExpression.value !== 'neutral') selectedExpression.value = 'neutral'
  else portraitFailed.value = true
}

watch(
  () => props.expression,
  (value) => {
    selectedExpression.value = value
    portraitFailed.value = false
  },
)
</script>

<style scoped>
.stage {
  position: relative;
  min-height: 0;
  overflow: hidden;
  background: linear-gradient(145deg, #203834, #566d66);
  isolation: isolate;
}
.background,
.vignette {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}
.background {
  object-fit: cover;
}
.vignette {
  z-index: 1;
  background: linear-gradient(90deg, rgba(9, 22, 19, 0.35), transparent 48%, rgba(9, 22, 19, 0.12));
}
.portrait {
  position: absolute;
  z-index: 2;
  right: clamp(2%, 7vw, 12%);
  bottom: -13%;
  width: min(52%, 520px);
  height: 112%;
  object-fit: contain;
  object-position: bottom center;
  filter: drop-shadow(0 18px 28px rgba(7, 18, 16, 0.32));
  transform-origin: 50% 88%;
  transition:
    opacity 160ms ease,
    transform 220ms ease;
}
.portrait-fallback {
  position: absolute;
  z-index: 2;
  right: 15%;
  bottom: 10%;
  display: grid;
  place-items: center;
  width: min(38vw, 300px);
  aspect-ratio: 0.72;
  border-radius: 48% 48% 12% 12%;
  color: rgba(255, 255, 255, 0.82);
  background: linear-gradient(#526b64, #203834);
  font-size: 3rem;
}
.action-nod .portrait {
  animation: nod 420ms ease-out 1;
}
.action-head_tilt .portrait {
  transform: rotate(1.25deg);
}
@keyframes nod {
  50% {
    transform: translateY(7px) rotate(0.3deg);
  }
}
@media (max-width: 760px) {
  .portrait {
    right: 5%;
    width: min(72%, 430px);
  }
}
@media (max-height: 650px) {
  .portrait {
    opacity: 0.62;
  }
}
@media (prefers-reduced-motion: reduce) {
  .portrait {
    transition: none;
    animation: none !important;
    transform: none !important;
  }
}
</style>
