<template>
  <main class="login-page">
    <section class="intro" aria-labelledby="platform-title">
      <p class="eyebrow">成果导向</p>
      <h1 id="platform-title">AI 智能外贸谈判训练平台</h1>
      <p>©AI赋能：智能时代的外贸谈判策略与实战 项目组</p>
    </section>
    <section class="panel" aria-labelledby="login-title">
      <h2 id="login-title">欢迎</h2>
      <p>学生、教师和技术员使用各自账号登录。</p>
      <LoginForm :submitting="submitting" :error-message="errorMessage" @submit="handleLogin" />
    </section>
  </main>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'

import LoginForm from '@/features/auth/components/LoginForm.vue'
import { useAuthStore } from '@/features/auth/stores/auth'
import { homePathForRoles } from '@/features/auth/utils/roleNavigation'
import { ApiError } from '@/shared/api/http'

const auth = useAuthStore()
const router = useRouter()
const submitting = ref(false)
const errorMessage = ref('')

async function handleLogin(credentials: { identifier: string; password: string }): Promise<void> {
  submitting.value = true
  errorMessage.value = ''
  try {
    await auth.login(credentials.identifier, credentials.password)
    await router.replace(homePathForRoles(auth.user?.roles ?? []))
  } catch (cause) {
    errorMessage.value = cause instanceof ApiError ? cause.message : '暂时无法登录，请稍后重试。'
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped>
.login-page {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(320px, 440px);
  align-items: center;
  gap: clamp(40px, 8vw, 120px);
  width: min(1120px, calc(100% - 40px));
  min-height: 100vh;
  margin: 0 auto;
  padding: 48px 0;
}

.intro {
  max-width: 640px;
}

.eyebrow {
  margin: 0 0 var(--space-3);
  color: var(--color-primary);
  font-weight: 750;
  letter-spacing: 0.08em;
}

h1 {
  max-width: 12ch;
  margin: 0;
  font-size: clamp(2.4rem, 7vw, 5rem);
  line-height: 1.04;
  letter-spacing: -0.04em;
}

.intro > p:last-child {
  max-width: 48ch;
  margin: var(--space-6) 0 0;
  color: var(--color-muted);
  font-size: 1.08rem;
}

.panel {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: var(--space-8);
  background: var(--color-surface);
  box-shadow: var(--shadow-soft);
}

.panel h2 {
  margin: 0;
}

.panel > p {
  margin: var(--space-2) 0 var(--space-6);
  color: var(--color-muted);
}

@media (max-width: 820px) {
  .login-page {
    grid-template-columns: 1fr;
    align-content: center;
  }

  h1 {
    max-width: 16ch;
    font-size: clamp(2.2rem, 11vw, 4rem);
  }
}
</style>
