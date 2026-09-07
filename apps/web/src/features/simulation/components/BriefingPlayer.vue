<template>
  <section v-if="!summaryMode" class="briefing-player" aria-labelledby="briefing-title">
    <header>
      <span>情境简报 {{ index + 1 }}/{{ briefing.length }}</span>
      <button type="button" @click="skip">跳过演出</button>
    </header>
    <div class="scene">
      <CharacterStage
        :display-name="displayName"
        :expression="current?.expression ?? 'neutral'"
        :action="current?.action ?? 'none'"
      />
      <article>
        <p id="briefing-title" aria-hidden="true">{{ visibleText }}</p>
        <p class="sr-only" aria-live="polite">{{ current?.rendered_text }}</p>
        <button v-if="typing" type="button" @click="reveal">立即显示</button>
        <button v-else type="button" @click="next">{{ atEnd ? '查看任务摘要' : '下一句' }}</button>
      </article>
    </div>
  </section>
  <section v-else class="summary" aria-labelledby="briefing-summary-title">
    <div>
      <p>演出不会改变场景事实</p>
      <h2 id="briefing-summary-title">本场任务摘要</h2>
      <span v-if="briefingStatus === 'fallback'">叙事生成未通过校验，当前展示规范化公共摘要。</span>
    </div>
    <ol>
      <li v-for="item in briefing" :key="item.id">{{ item.rendered_text }}</li>
    </ol>
    <footer>
      <button type="button" class="secondary" @click="replay">重看演出</button>
      <button type="button" @click="$emit('enter')">进入谈判</button>
    </footer>
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'

import CharacterStage from './CharacterStage.vue'
import { useTypewriter } from '../composables/useTypewriter'
import type { BriefingBeat } from '../types'

const props = defineProps<{
  briefing: BriefingBeat[]
  briefingStatus: string
  displayName: string
  startInSummary?: boolean
}>()
defineEmits<{ enter: [] }>()
const index = ref(0)
const summaryMode = ref(props.startInSummary)
const speed = ref<'standard'>('standard')
const current = computed(() => props.briefing[index.value])
const text = computed(() => current.value?.rendered_text ?? '')
const { visibleText, typing, reveal } = useTypewriter(text, speed)
const atEnd = computed(() => index.value >= props.briefing.length - 1)

function next(): void {
  if (atEnd.value) summaryMode.value = true
  else index.value += 1
}
function skip(): void {
  summaryMode.value = true
}
function replay(): void {
  index.value = 0
  summaryMode.value = false
}
defineExpose({ replay, showSummary: skip })
</script>

<style scoped>
.briefing-player,
.summary {
  min-height: min(680px, calc(100dvh - 160px));
  overflow: hidden;
  border: 1px solid var(--color-border);
  border-radius: 16px;
  background: white;
}
.briefing-player > header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  min-height: 48px;
  padding: 0 18px;
  color: var(--color-muted);
  font-size: 0.8rem;
}
button {
  min-height: 38px;
  padding: 0 16px;
  border: 0;
  border-radius: 8px;
  color: white;
  background: var(--color-primary);
  cursor: pointer;
}
.briefing-player > header button,
.secondary {
  color: var(--color-primary);
  background: transparent;
}
.scene {
  position: relative;
  height: min(620px, calc(100dvh - 210px));
}
.scene > :first-child {
  height: 100%;
}
.scene article {
  position: absolute;
  z-index: 4;
  right: 5%;
  bottom: 5%;
  left: 5%;
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 14px;
  align-items: end;
  min-height: 120px;
  padding: 22px;
  border: 1px solid rgba(255, 255, 255, 0.45);
  border-radius: 14px;
  color: white;
  background: rgba(10, 28, 24, 0.9);
  box-shadow: 0 20px 50px rgba(3, 12, 10, 0.34);
}
.scene article p {
  margin: 0;
  font-size: clamp(1rem, 2vw, 1.3rem);
  line-height: 1.7;
}
.summary {
  display: grid;
  align-content: center;
  gap: 22px;
  padding: clamp(24px, 6vw, 68px);
}
.summary > div p,
.summary h2 {
  margin: 0;
}
.summary > div p {
  color: var(--color-primary);
  font-size: 0.75rem;
  font-weight: 800;
}
.summary > div span {
  color: var(--color-muted);
}
.summary ol {
  display: grid;
  gap: 10px;
  margin: 0;
  padding-left: 24px;
  line-height: 1.55;
}
.summary footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
}
@media (max-width: 600px) {
  .briefing-player,
  .summary {
    min-height: calc(100dvh - 150px);
    border-radius: 10px;
  }
  .scene {
    height: calc(100dvh - 200px);
  }
  .scene article {
    right: 10px;
    bottom: 10px;
    left: 10px;
    grid-template-columns: 1fr;
    padding: 15px;
  }
  .scene article button {
    justify-self: end;
  }
  .summary {
    padding: 20px;
  }
}
</style>
