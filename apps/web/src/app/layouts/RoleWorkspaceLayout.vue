<template>
  <div class="shell">
    <header class="app-header">
      <div>
        <p class="eyebrow">AI 外贸谈判训练平台</p>
        <h1>{{ title }}</h1>
      </div>
      <button type="button" @click="signOut">退出登录</button>
    </header>
    <main>
      <p v-if="description" class="description">{{ description }}</p>
      <slot />
    </main>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'

import { useAuthStore } from '@/features/auth/stores/auth'

defineProps<{ title: string; description?: string }>()

const auth = useAuthStore()
const router = useRouter()

async function signOut(): Promise<void> {
  try {
    await auth.logout()
  } finally {
    await router.replace('/login')
  }
}
</script>

<style scoped>
.shell {
  width: min(1220px, calc(100% - 32px));
  margin: 0 auto;
  padding: var(--space-8) 0;
}

.app-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-6);
  margin-bottom: var(--space-6);
  padding: 0 var(--space-2);
}

.eyebrow,
h1,
.description {
  margin: 0;
}

.eyebrow {
  color: var(--color-primary);
  font-size: 0.85rem;
  font-weight: 750;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

h1 {
  margin-top: var(--space-2);
  font-size: clamp(1.8rem, 4vw, 2.7rem);
}

.app-header button {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  padding: var(--space-2) var(--space-4);
  color: var(--color-ink);
  background: var(--color-surface);
  cursor: pointer;
  transition:
    border-color 160ms ease,
    transform 160ms ease;
}
.app-header button:hover {
  border-color: var(--color-primary);
  transform: translateY(-1px);
}

main {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: clamp(24px, 4vw, 44px);
  background: var(--color-surface);
  box-shadow: var(--shadow-soft);
  animation: workspace-in 260ms ease-out both;
}
@keyframes workspace-in {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
}

.description {
  max-width: 68ch;
  padding-bottom: var(--space-6);
  color: var(--color-muted);
}

@media (max-width: 640px) {
  .shell {
    width: min(100% - 24px, 1220px);
    padding: var(--space-6) 0;
  }

  main {
    padding: var(--space-6);
  }
}
</style>
