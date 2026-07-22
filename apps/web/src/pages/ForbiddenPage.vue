<template>
  <main class="message-page">
    <section>
      <p class="code">403</p>
      <h1>无权访问此工作区</h1>
      <p>当前账号没有该角色权限。请返回自己的工作区。</p>
      <RouterLink :to="homePath">返回工作区</RouterLink>
    </section>
  </main>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'

import { useAuthStore } from '@/features/auth/stores/auth'
import { homePathForRoles } from '@/features/auth/utils/roleNavigation'

const auth = useAuthStore()
const homePath = computed(() => homePathForRoles(auth.user?.roles ?? []))
</script>

<style scoped>
.message-page {
  display: grid;
  min-height: 100vh;
  place-items: center;
  padding: var(--space-6);
  text-align: center;
}

.code {
  color: var(--color-primary);
  font-weight: 800;
}

a {
  color: var(--color-primary-strong);
  font-weight: 700;
}
</style>
