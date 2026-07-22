<template>
  <aside :class="['brief', { collapsed }]" aria-label="场景简报">
    <button
      v-if="collapsible"
      class="collapse-button"
      type="button"
      :aria-label="collapsed ? '展开场景简报' : '收起场景简报'"
      :aria-expanded="!collapsed"
      @click="$emit('toggle')"
    >
      <span aria-hidden="true">{{ collapsed ? '›' : '‹' }}</span>
    </button>
    <div v-if="collapsed" class="collapsed-label" aria-hidden="true">场景简报</div>
    <div v-else class="brief-content">
      <p class="eyebrow">场景简报</p>
      <h2>{{ scenario.scenario_title }}</h2>
      <p>{{ scenario.scenario_summary }}</p>
      <dl>
        <div>
          <dt>你的角色</dt>
          <dd>{{ scenario.student_role }}</dd>
        </div>
        <div>
          <dt>谈判对手</dt>
          <dd>{{ scenario.ai_role }}</dd>
        </div>
        <div>
          <dt>标的</dt>
          <dd>{{ scenario.product }}</dd>
        </div>
        <div>
          <dt>本轮任务</dt>
          <dd>{{ scenario.student_task }}</dd>
        </div>
      </dl>
    </div>
  </aside>
</template>

<script setup lang="ts">
import type { ScenarioPublic } from '../types'

withDefaults(
  defineProps<{ scenario: ScenarioPublic; collapsed?: boolean; collapsible?: boolean }>(),
  { collapsed: false, collapsible: true },
)
defineEmits<{ toggle: [] }>()
</script>

<style scoped>
.brief {
  position: relative;
  min-width: 0;
  padding: var(--space-6);
  overflow: auto;
  border-right: 1px solid var(--color-border);
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--color-primary) 5%, white), transparent 220px),
    #f7faf8;
}
.brief.collapsed {
  display: grid;
  place-items: center;
  padding: var(--space-3) 0;
  overflow: visible;
}
.collapse-button {
  position: absolute;
  z-index: 2;
  top: 50%;
  right: -14px;
  display: grid;
  width: 28px;
  height: 46px;
  padding: 0;
  place-items: center;
  transform: translateY(-50%);
  border: 1px solid var(--color-border);
  border-radius: 0 999px 999px 0;
  color: var(--color-primary);
  background: var(--color-surface);
  box-shadow: 3px 0 12px rgb(22 62 48 / 10%);
  cursor: pointer;
}
.collapse-button:hover {
  background: var(--color-primary-soft, #e8f3ee);
}
.collapse-button span {
  font-size: 1.4rem;
  line-height: 1;
}
.collapsed-label {
  color: var(--color-muted);
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.16em;
  writing-mode: vertical-rl;
}
.eyebrow {
  color: var(--color-primary);
  font-size: 0.8rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
h2 {
  margin: var(--space-2) 0 var(--space-4);
  font-size: 1.25rem;
}
p {
  margin: 0;
  color: var(--color-muted);
}
dl {
  display: grid;
  gap: var(--space-4);
  margin: var(--space-6) 0 0;
}
dl div {
  padding-top: var(--space-3);
  border-top: 1px solid var(--color-border);
}
dt {
  color: var(--color-muted);
  font-size: 0.8rem;
}
dd {
  margin: var(--space-1) 0 0;
}
@media (max-width: 900px) {
  .brief.collapsed {
    min-height: 52px;
  }
  .collapsed-label {
    writing-mode: initial;
  }
  .collapse-button {
    top: auto;
    right: var(--space-4);
    bottom: -14px;
    width: 46px;
    height: 28px;
    transform: rotate(90deg);
  }
}
</style>
