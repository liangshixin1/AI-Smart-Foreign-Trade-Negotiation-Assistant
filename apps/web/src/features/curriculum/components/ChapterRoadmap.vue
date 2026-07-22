<template>
  <section class="roadmap" aria-labelledby="roadmap-title">
    <h2 id="roadmap-title">课程路线</h2>
    <article
      v-for="(chapter, chapterIndex) in chapters"
      :key="chapter.id"
      :style="{ '--chapter-index': chapterIndex }"
    >
      <p class="chapter-label">
        <span>{{ String(chapterIndex + 1).padStart(2, '0') }}</span
        >{{ chapter.title }}
      </p>
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
    </article>
  </section>
</template>

<script setup lang="ts">
import { RouterLink } from 'vue-router'
import type { ChapterMapItem } from '@/features/curriculum/types'
import type { UnitMapItem } from '@/features/curriculum/types'

defineProps<{ chapters: ChapterMapItem[] }>()

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

article {
  position: relative;
  display: grid;
  gap: var(--space-3);
  padding-left: var(--space-6);
  animation: chapter-in 280ms ease-out both;
  animation-delay: calc(var(--chapter-index) * 30ms);
}
article::before {
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
  margin-left: -2.05rem;
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
  padding: var(--space-4);
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
</style>
