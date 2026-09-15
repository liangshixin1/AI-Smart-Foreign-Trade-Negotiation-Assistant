<!-- [组件导读]
业务名词：Attempt 是一次训练记录；场景是本次任务与约束，逐轮反馈是单轮建议，正式评价在确认提交后形成。
用途：展示对话消息及对应轮次反馈，并在教师回放时支持选择轮次。
逻辑：按 assistant_message_id 将反馈关联到消息；监听内容变化控制滚动，阅读旧消息时不会因同一条流式增量强制滚到底部。
结构：template 描述页面结构；script setup 声明输入、状态和事件；style 定义外观。
阅读线索：子组件 RoundFeedbackCard。
为什么：流式消息会频繁变长；跟随开关使更新与回看旧消息可以同时成立。
[/组件导读] -->
<template>
  <div class="timeline-shell">
    <div ref="timelineElement" class="timeline" aria-live="polite" @scroll.passive="handleScroll">
      <template v-for="message in messages" :key="message.id">
        <article :class="['message', message.role, { failed: message.status === 'failed' }]">
          <p class="speaker">
            {{ message.role === 'student' ? '你 · 买方' : 'David Lim · 卖方' }}
            <span v-if="message.status === 'streaming'"> · 正在输入</span>
          </p>
          <p v-if="message.status === 'failed'">本轮 AI 回复失败，你的上一条消息已经保存。</p>
          <p v-else>{{ message.content }}</p>
        </article>
        <div
          v-if="feedbackFor(message.id)"
          :class="[
            'feedback-selectable',
            {
              enabled: selectableRounds,
              selected: selectedRoundId === feedbackFor(message.id)?.id,
            },
          ]"
          :role="selectableRounds ? 'button' : undefined"
          :tabindex="selectableRounds ? 0 : undefined"
          @click="selectRound(feedbackFor(message.id)?.id)"
          @keydown.enter="selectRound(feedbackFor(message.id)?.id)"
          @keydown.space.prevent="selectRound(feedbackFor(message.id)?.id)"
        >
          <RoundFeedbackCard :evaluation="feedbackFor(message.id)!" />
        </div>
      </template>
    </div>
    <button
      v-if="showJumpButton"
      class="jump-latest"
      type="button"
      aria-label="回到最新消息"
      title="回到最新消息"
      @click="jumpToLatest"
    >
      <span aria-hidden="true">↓</span>
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'

import type { RoundEvaluation, TrainingMessage } from '../types'
import RoundFeedbackCard from './RoundFeedbackCard.vue'

const props = withDefaults(
  defineProps<{
    messages: TrainingMessage[]
    evaluations: RoundEvaluation[]
    selectableRounds?: boolean
    selectedRoundId?: string | null
  }>(),
  { selectableRounds: false, selectedRoundId: null },
)
const emit = defineEmits<{ 'select-round': [roundId: string] }>()
const timelineElement = ref<HTMLElement | null>(null)
const followsLatest = ref(true)
const showJumpButton = ref(false)
const previousMessageCount = ref(props.messages.length)

const contentSignature = computed(() =>
  props.messages
    .map((message) => `${message.id}:${message.status}:${String(message.content.length)}`)
    .join('|'),
)

// [导读] 用距底部小于 96 像素判断用户是否还在阅读最新消息。
function isNearBottom(element: HTMLElement): boolean {
  return element.scrollHeight - element.scrollTop - element.clientHeight < 96
}

// [导读] 依据滚动位置更新自动跟随开关和跳到最新消息按钮。
function handleScroll(): void {
  const element = timelineElement.value
  if (!element) return
  const nearBottom = isNearBottom(element)
  followsLatest.value = nearBottom
  showJumpButton.value = !nearBottom
}

// [导读] 滚动到底部并恢复跟随；系统偏好减少动画时采用即时滚动。
function scrollToLatest(behavior: ScrollBehavior): void {
  const element = timelineElement.value
  if (!element) return
  const reducedMotion = element.ownerDocument.defaultView?.matchMedia(
    '(prefers-reduced-motion: reduce)',
  ).matches
  element.scrollTo({ top: element.scrollHeight, behavior: reducedMotion ? 'auto' : behavior })
  followsLatest.value = true
  showJumpButton.value = false
}

// [导读] 响应用户主动跳到最新消息的操作，重新启用跟随。
function jumpToLatest(): void {
  scrollToLatest('smooth')
}

watch([contentSignature, () => props.evaluations.length], async () => {
  const receivedNewMessage = props.messages.length > previousMessageCount.value
  previousMessageCount.value = props.messages.length
  await nextTick()
  // 新一轮开始时主动跟随；用户若上滑回看，则流式增量不再抢走阅读位置。
  if (receivedNewMessage || followsLatest.value) scrollToLatest('smooth')
})

onMounted(async () => {
  await nextTick()
  scrollToLatest('auto')
})

// [导读] 用助手消息编号关联轮次评价，避免把反馈挂到另一轮消息上。
function feedbackFor(messageId: string): RoundEvaluation | undefined {
  return props.evaluations.find((item) => item.assistant_message_id === messageId)
}
// [导读] 仅在启用轮次选择且编号有效时发出事件，普通训练显示不触发教师回放联动。
function selectRound(roundId: string | undefined): void {
  if (props.selectableRounds && roundId) emit('select-round', roundId)
}
</script>

<style scoped>
.timeline-shell {
  position: relative;
  min-height: 0;
  overflow: hidden;
}
.timeline {
  display: flex;
  height: 100%;
  flex-direction: column;
  gap: var(--space-4);
  min-height: 0;
  padding: var(--space-6);
  overflow-y: auto;
}
.message {
  width: min(90%, 680px);
  padding: var(--space-4);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  box-shadow: 0 8px 24px rgb(21 58 45 / 4%);
  animation: message-in 180ms ease-out both;
}
.message.assistant:has(.speaker span) {
  border-color: color-mix(in srgb, var(--color-primary) 35%, var(--color-border));
}
.message.student {
  align-self: flex-end;
  border-color: #b7d6c9;
  background: #edf7f2;
}
.message.failed {
  border-color: #e2bbb7;
  background: #fff5f4;
}
.speaker {
  margin: 0 0 var(--space-2);
  color: var(--color-muted);
  font-size: 0.78rem;
  font-weight: 700;
}
.message p:last-child {
  margin: 0;
  white-space: pre-wrap;
}
.jump-latest {
  position: absolute;
  bottom: var(--space-3);
  left: 50%;
  display: grid;
  width: 42px;
  height: 42px;
  padding: 0;
  place-items: center;
  border: 1px solid color-mix(in srgb, var(--color-primary) 28%, var(--color-border));
  border-radius: 999px;
  color: white;
  background: var(--color-primary);
  box-shadow: var(--shadow-raised, 0 8px 24px rgb(22 62 48 / 14%));
  backdrop-filter: blur(8px);
  cursor: pointer;
  transform: translateX(-50%);
  animation: bubble-in 180ms ease-out both;
}
.jump-latest:hover {
  background: var(--color-primary-strong);
  transform: translate(-50%, -2px);
}
.jump-latest span {
  font-size: 1.2rem;
  line-height: 1;
}
.feedback-selectable.enabled {
  border: 2px solid transparent;
  border-radius: var(--radius-md);
  cursor: pointer;
  transition:
    border-color 160ms ease,
    transform 160ms ease;
}
.feedback-selectable.enabled:hover,
.feedback-selectable.enabled:focus-visible {
  border-color: #d6a041;
  outline: none;
  transform: translateY(-1px);
}
.feedback-selectable.selected {
  border-color: #d99427;
  box-shadow: 0 0 0 3px rgb(217 148 39 / 12%);
}
@keyframes message-in {
  from {
    opacity: 0;
    transform: translateY(7px);
  }
}
@keyframes bubble-in {
  from {
    opacity: 0;
    transform: translate(-50%, 6px) scale(0.92);
  }
}
@media (prefers-reduced-motion: reduce) {
  .message {
    animation: none;
  }
}
@media (max-width: 640px) {
  .timeline {
    padding: 16px 14px;
    gap: 14px;
  }
  .message {
    width: 94%;
    padding: 14px;
    font-size: 14px;
    box-shadow: none;
  }
}
</style>
