<template>
  <figure class="radar" :aria-label="chartLabel">
    <svg v-if="dimensions.length >= 3" viewBox="0 0 260 260" role="img">
      <g class="grid">
        <polygon v-for="level in 5" :key="level" :points="gridPoints(level / 5)" />
        <line
          v-for="point in outerPoints"
          :key="`${point.x}-${point.y}`"
          :x1="center"
          :y1="center"
          :x2="point.x"
          :y2="point.y"
        />
      </g>
      <polygon class="score-area" :points="scorePoints" />
      <circle
        v-for="point in scorePointList"
        :key="`${point.x}-${point.y}`"
        :cx="point.x"
        :cy="point.y"
        r="3.5"
      />
    </svg>
    <div v-else class="single-score">{{ Math.round(dimensions[0]?.score ?? 0) }}</div>
    <figcaption>
      <span v-for="dimension in dimensions" :key="dimension.dimension_key">
        <i aria-hidden="true"></i>{{ dimension.label }}
        <strong>{{ Math.round(dimension.score) }}</strong>
      </span>
    </figcaption>
  </figure>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import type { EvaluationDimension } from '@/features/training/types'

const props = defineProps<{ dimensions: EvaluationDimension[] }>()
const center = 130
const radius = 98

interface Point {
  x: number
  y: number
}

function pointAt(index: number, ratio: number): Point {
  const angle = -Math.PI / 2 + (Math.PI * 2 * index) / props.dimensions.length
  return {
    x: center + Math.cos(angle) * radius * ratio,
    y: center + Math.sin(angle) * radius * ratio,
  }
}

function pointsToString(points: Point[]): string {
  return points.map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(' ')
}

function gridPoints(ratio: number): string {
  return pointsToString(props.dimensions.map((_, index) => pointAt(index, ratio)))
}

const outerPoints = computed(() => props.dimensions.map((_, index) => pointAt(index, 1)))
const scorePointList = computed(() =>
  props.dimensions.map((dimension, index) => pointAt(index, dimension.score / 100)),
)
const scorePoints = computed(() => pointsToString(scorePointList.value))
const chartLabel = computed(
  () =>
    `能力雷达图：${props.dimensions
      .map((dimension) => `${dimension.label} ${String(Math.round(dimension.score))} 分`)
      .join('，')}`,
)
</script>

<style scoped>
.radar {
  display: grid;
  grid-template-columns: minmax(220px, 300px) 1fr;
  align-items: center;
  gap: var(--space-6);
  margin: 0;
}
svg {
  width: 100%;
  max-height: 290px;
  overflow: visible;
}
.grid polygon,
.grid line {
  fill: none;
  stroke: #d9e5df;
  stroke-width: 1;
}
.score-area {
  fill: color-mix(in srgb, var(--color-primary) 22%, transparent);
  stroke: var(--color-primary);
  stroke-width: 2.5;
  transform-origin: center;
  animation: radar-in 520ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
}
circle {
  fill: var(--color-primary);
  stroke: white;
  stroke-width: 2;
}
figcaption {
  display: grid;
  gap: var(--space-2);
}
figcaption span {
  display: grid;
  grid-template-columns: 8px minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--space-2);
  color: var(--color-muted);
  font-size: 0.85rem;
}
figcaption i {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--color-primary);
}
figcaption strong {
  color: var(--color-ink);
  font-variant-numeric: tabular-nums;
}
.single-score {
  display: grid;
  width: 160px;
  height: 160px;
  place-items: center;
  border: 14px solid var(--color-primary-soft, #e8f3ee);
  border-radius: 50%;
  color: var(--color-primary);
  font-size: 2.4rem;
  font-weight: 800;
}
@keyframes radar-in {
  from {
    opacity: 0;
    transform: scale(0.45);
  }
}
@media (max-width: 680px) {
  .radar {
    grid-template-columns: 1fr;
  }
  svg {
    max-height: 240px;
  }
}
@media (prefers-reduced-motion: reduce) {
  .score-area {
    animation: none;
  }
}
</style>
