<template>
  <section class="status" aria-live="polite">
    <p v-if="loading" class="muted">正在连接工作区…</p>
    <template v-else-if="error">
      <p class="error" role="alert">{{ error }}</p>
      <button type="button" @click="reload">重试</button>
    </template>
    <p v-else>{{ message }}</p>
  </section>
</template>

<script setup lang="ts">
import type { UserRole } from '@/features/auth/types'
import { useWorkspaceProbe } from '@/features/workspace/composables/useWorkspaceProbe'

const props = defineProps<{ role: UserRole }>()
const { loading, message, error, reload } = useWorkspaceProbe(props.role)
</script>

<style scoped>
.status {
  border-top: 1px solid var(--color-border);
  padding-top: var(--space-6);
}

.muted {
  color: var(--color-muted);
}

.error {
  color: var(--color-danger);
}

button {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  padding: var(--space-2) var(--space-4);
  background: var(--color-surface);
  cursor: pointer;
}
</style>
