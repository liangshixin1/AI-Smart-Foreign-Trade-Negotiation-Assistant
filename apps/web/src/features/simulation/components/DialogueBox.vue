<template>
  <section class="dialogue" aria-labelledby="speaker-name" tabindex="0" @keydown="handleKeydown">
    <header>
      <img v-if="!avatarFailed" :src="assets.avatar" alt="" @error="avatarFailed = true" />
      <span v-if="avatarFailed" class="avatar-fallback" aria-hidden="true">DL</span>
      <div>
        <strong id="speaker-name">{{ displayName }}</strong>
        <small>{{ turn ? `第 ${turn.conversation_revision} 轮` : '等待对手回应' }}</small>
      </div>
    </header>
    <div class="speech">
      <p aria-hidden="true">{{ visibleText || (thinking ? '…' : '') }}</p>
      <p class="sr-only" aria-live="polite">{{ currentBeat?.text ?? '' }}</p>
    </div>
    <footer v-if="turn">
      <label>
        速度
        <select v-model="speed">
          <option value="slow">慢</option>
          <option value="standard">标准</option>
          <option value="fast">快</option>
          <option value="instant">立即</option>
        </select>
      </label>
      <button v-if="typing" type="button" @click="showAll">立即显示</button>
      <button v-else-if="!complete" type="button" @click="advance">下一句</button>
      <span v-else class="ready">可以回复了</span>
    </footer>
  </section>
</template>

<script setup lang="ts">
import { computed, ref, toRef } from 'vue'

import { useDialoguePlayback } from '../composables/useDialoguePlayback'
import { useSimulationAssets } from '../composables/useSimulationAssets'
import type { SimulationPresentation } from '../types'

const props = defineProps<{
  displayName: string
  turn: SimulationPresentation | null
  thinking: boolean
}>()
const assets = useSimulationAssets()
const avatarFailed = ref(false)
const { currentBeat, visibleText, typing, complete, speed, advance, showAll } = useDialoguePlayback(
  toRef(props, 'turn'),
)

function handleKeydown(event: KeyboardEvent): void {
  if (event.target !== event.currentTarget || event.isComposing) return
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault()
    advance()
  }
}

const expression = computed(() => currentBeat.value?.expression ?? 'neutral')
const action = computed(() => currentBeat.value?.action ?? 'none')
defineExpose({ complete, expression, action, showAll })
</script>

<style scoped>
.dialogue {
  position: relative;
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: var(--space-3) var(--space-4);
  min-height: 132px;
  padding: var(--space-4) var(--space-5);
  border: 1px solid rgba(255, 255, 255, 0.48);
  border-radius: 16px;
  color: #f7fbf9;
  background: rgba(10, 28, 24, 0.89);
  box-shadow: 0 18px 48px rgba(6, 17, 14, 0.34);
  backdrop-filter: blur(14px);
}
header {
  display: contents;
}
header img,
.avatar-fallback {
  grid-row: 1 / span 2;
  width: 52px;
  height: 52px;
  border-radius: 50%;
  object-fit: cover;
  background: #48625b;
}
.avatar-fallback {
  display: grid;
  place-items: center;
  font-weight: 800;
}
header div {
  display: grid;
  align-content: start;
}
header small {
  color: rgba(255, 255, 255, 0.66);
}
.speech {
  grid-column: 2 / 4;
  min-height: 48px;
}
.speech p {
  margin: 0;
  font-size: clamp(1rem, 1.8vw, 1.2rem);
  line-height: 1.65;
}
footer {
  grid-column: 2 / 4;
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 10px;
}
footer label {
  display: flex;
  align-items: center;
  gap: 6px;
  color: rgba(255, 255, 255, 0.7);
  font-size: 0.75rem;
}
select,
button {
  min-height: 34px;
  border: 1px solid rgba(255, 255, 255, 0.25);
  border-radius: 8px;
  color: white;
  background: rgba(255, 255, 255, 0.08);
}
button {
  padding: 0 14px;
  cursor: pointer;
}
.ready {
  color: #bde7d6;
  font-size: 0.78rem;
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
  border: 0;
}
@media (max-width: 600px) {
  .dialogue {
    min-height: 118px;
    padding: 12px;
    gap: 8px 12px;
    border-radius: 12px;
  }
  header img,
  .avatar-fallback {
    width: 42px;
    height: 42px;
  }
  .speech {
    grid-column: 1 / 4;
  }
  footer {
    grid-column: 1 / 4;
  }
}
</style>
