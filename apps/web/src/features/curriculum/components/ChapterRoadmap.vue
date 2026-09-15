<!-- [组件导读]
业务名词：课程由章节和小节组成；小节是训练入口，一次实际作答会形成独立的 Attempt（训练记录）。
用途：按章节展示课程小节、解锁状态以及继续训练入口。
逻辑：根据小节状态和 active_attempt_id 选择准备页、训练页或评价页；锁定项由模板区别呈现。
结构：template 描述页面结构；script setup 声明输入、状态和事件；style 定义外观。
为什么：课程路线与训练记录分开，才能保留重复练习历史并按前置要求开放小节。
[/组件导读] -->
<template>
  <section class="roadmap" aria-labelledby="roadmap-title">
    <h2 id="roadmap-title">课程路线</h2>
    <details
      v-for="(chapter, chapterIndex) in chapters"
      :key="chapter.id"
      :open="
        chapterIndex === 0 ||
        chapter.units.some((unit) =>
          ['in_progress', 'pending_evaluation', 'evaluation_failed'].includes(unit.status),
        )
      "
      :style="{ '--chapter-index': chapterIndex }"
    >
      <summary class="chapter-label">
        <span>{{ String(chapterIndex + 1).padStart(2, '0') }}</span
        >{{ chapter.title }}
        <small
          >{{ chapter.units.filter((unit) => unit.status === 'completed').length }} /
          {{ chapter.units.length }}</small
        >
        <i aria-hidden="true">⌄</i>
      </summary>
      <template v-for="unit in chapter.units" :key="unit.id">
        <div v-if="unit.status === 'locked'" class="unit locked" aria-disabled="true">
          <div>
            <strong>{{ unit.title }}</strong>
            <p>{{ unit.description }}</p>
          </div>
          <span class="unit-meta"
            >{{ unit.estimated_minutes }} 分钟 · {{ statusLabel(unit.status) }}</span
          >
        </div>
        <RouterLink v-else :class="['unit', `status-${unit.status}`]" :to="unitTarget(unit)">
          <div>
            <strong>{{ unit.title }}</strong>
            <p>{{ unit.description }}</p>
          </div>
          <span class="unit-meta"
            >{{ unit.estimated_minutes }} 分钟 · {{ statusLabel(unit.status) }}</span
          >
        </RouterLink>
      </template>
    </details>
  </section>
</template>

<script setup lang="ts">
import { RouterLink } from 'vue-router'
import type { ChapterMapItem } from '@/features/curriculum/types'
import type { UnitMapItem } from '@/features/curriculum/types'

defineProps<{ chapters: ChapterMapItem[] }>()

// [导读] 把接口状态码映射为面向使用者的中文文案；未知值按函数中的兜底分支处理。
function statusLabel(status: string): string {
  const labels: Record<string, string> = {
    available: '可开始',
    in_progress: '继续训练',
    pending_evaluation: '评价中',
    evaluation_failed: '评价待重试',
    completed: '已完成',
    locked: '先完成前置小节',
  }
  return labels[status] ?? status
}

// [导读] 没有训练记录时去准备页；已完成或评价失败时去评价页，其他状态继续当前训练。
function unitTarget(unit: UnitMapItem): string {
  if (!unit.active_attempt_id) return `/student/units/${unit.id}`
  if (unit.status === 'completed' || unit.status === 'evaluation_failed') {
    return `/student/attempts/${unit.active_attempt_id}/evaluation`
  }
  return `/student/attempts/${unit.active_attempt_id}`
}
</script>

<style scoped>
.roadmap {
  display: grid;
  gap: var(--space-4);
  padding-top: var(--space-8);
}

h2,
p {
  margin: 0;
}

details {
  position: relative;
  padding: 0 0 0 24px;
  animation: chapter-in 280ms ease-out both;
  animation-delay: calc(var(--chapter-index) * 30ms);
}
details::before {
  position: absolute;
  top: 2rem;
  bottom: -1rem;
  left: 6px;
  width: 1px;
  background: var(--color-border);
  content: '';
}

.chapter-label {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  color: var(--color-muted);
  font-weight: 700;
}
.chapter-label span {
  display: grid;
  width: 30px;
  height: 30px;
  margin-left: -24px;
  place-items: center;
  border: 1px solid var(--color-border);
  border-radius: 50%;
  color: var(--color-primary);
  background: var(--color-surface);
  font-size: 0.7rem;
}

.unit {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-6);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  padding: 18px 20px;
  margin-top: 10px;
  color: inherit;
  text-decoration: none;
  background: var(--color-surface);
  transition:
    border-color 160ms ease,
    box-shadow 160ms ease,
    transform 160ms ease;
}

a:hover {
  border-color: var(--color-primary);
  box-shadow: 0 10px 24px rgb(25 52 42 / 8%);
  transform: translateY(-2px);
}

.unit p,
.unit span {
  color: var(--color-muted);
  font-size: 0.9rem;
}
.locked {
  color: var(--color-muted);
  background: var(--color-canvas);
}
.status-in_progress,
.status-pending_evaluation,
.status-evaluation_failed {
  border-left: 4px solid var(--color-accent);
}
.status-completed {
  border-left: 4px solid var(--color-primary);
  background: #f8fcfa;
}
.unit-meta {
  flex: 0 0 auto;
  padding: 0.28rem 0.55rem;
  border-radius: 999px;
  background: var(--color-canvas);
}
@keyframes chapter-in {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
}
@media (max-width: 620px) {
  .unit {
    align-items: flex-start;
    flex-direction: column;
    gap: var(--space-3);
  }
}
summary {
  list-style: none;
  min-height: 48px;
  cursor: pointer;
}
summary::-webkit-details-marker {
  display: none;
}
.chapter-label small {
  margin-left: auto;
  font-size: 11px;
  font-weight: 500;
  white-space: nowrap;
}
.chapter-label i {
  font-style: normal;
  transition: transform 180ms ease;
}
details[open] .chapter-label i {
  transform: rotate(180deg);
}
details:not([open])::before {
  display: none;
}
.unit p {
  margin-top: 6px;
  font-size: 13px;
}
@media (max-width: 620px) {
  .unit {
    padding: 14px;
  }
  .chapter-label {
    font-size: 13px;
    gap: 8px;
  }
}
</style>
