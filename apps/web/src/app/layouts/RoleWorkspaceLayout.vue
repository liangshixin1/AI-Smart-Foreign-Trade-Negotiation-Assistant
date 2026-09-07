<template>
  <div class="shell">
    <a class="skip-link" href="#workspace-content">跳至主要内容</a>
    <header class="app-header">
      <RouterLink class="brand" :to="homePath">
        <span class="brand-symbol" aria-hidden="true">N<span>↗</span></span>
        <span>外贸谈判<span class="brand-caption">NEGOTIATION LAB</span></span>
      </RouterLink>
      <nav class="main-nav" aria-label="主导航">
        <RouterLink :to="homePath" exact-active-class="is-active">{{ homeLabel }}</RouterLink>
        <RouterLink v-if="graphPath" :to="graphPath" active-class="is-active"
          >知识与策略</RouterLink
        >
      </nav>
      <div class="account">
        <span class="avatar" aria-hidden="true">{{
          auth.user?.display_name?.slice(0, 1) || 'N'
        }}</span>
        <span class="account-name">{{ auth.user?.display_name }}</span>
        <button type="button" @click="signOut">退出登录</button>
      </div>
    </header>
    <div class="page-heading">
      <p class="eyebrow">{{ roleLabel }} / WORKSPACE</p>
      <h1>{{ title }}</h1>
      <p v-if="description" class="description">{{ description }}</p>
    </div>
    <main id="workspace-content" tabindex="-1"><slot /></main>
    <footer class="app-footer">
      <span>AI 赋能 · 外贸谈判策略与实战</span><span>从知识理解，到真实表达。</span>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/features/auth/stores/auth'

defineProps<{ title: string; description?: string }>()
const auth = useAuthStore()
const route = useRoute()
const router = useRouter()
const role = computed(() => route.path.split('/')[1] ?? 'student')
const homePath = computed(() => `/${role.value}`)
const homeLabel = computed(() =>
  role.value === 'teacher' ? '班级概览' : role.value === 'technician' ? '平台管理' : '学习路线',
)
const roleLabel = computed(() =>
  role.value === 'teacher'
    ? '教学工作区'
    : role.value === 'technician'
      ? '技术工作区'
      : '学习工作区',
)
const graphPath = computed(() =>
  role.value === 'technician' ? null : `${homePath.value}/knowledge-graph`,
)
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
  width: min(1280px, calc(100% - 80px));
  margin: 0 auto;
}
.app-header {
  display: flex;
  align-items: center;
  gap: 40px;
  min-height: 88px;
  border-bottom: 1px solid var(--color-border);
}
.brand {
  display: flex;
  align-items: center;
  gap: 12px;
  color: var(--color-ink);
  text-decoration: none;
  font-weight: 750;
  white-space: nowrap;
}
.brand-symbol {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 42px;
  height: 42px;
  border-radius: 13px;
  background: var(--color-primary);
  color: white;
  font-size: 24px;
  font-weight: 550;
}
.brand-symbol > span {
  font-size: 17px;
  align-self: flex-start;
  margin-top: 4px;
}
.brand-caption {
  display: block;
  color: var(--color-muted);
  font-size: 9px;
  letter-spacing: 0.16em;
}
.main-nav {
  display: flex;
  align-self: stretch;
  gap: 26px;
}
.main-nav a {
  display: flex;
  align-items: center;
  position: relative;
  color: var(--color-muted);
  text-decoration: none;
  font-size: 14px;
  font-weight: 600;
}
.main-nav .is-active {
  color: var(--color-primary);
}
.main-nav .is-active::after {
  content: '';
  height: 3px;
  position: absolute;
  bottom: -1px;
  left: 0;
  right: 0;
  background: var(--color-primary);
  border-radius: 4px;
}
.account {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-left: auto;
  font-size: 13px;
}
.avatar {
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  border: 1px solid #d1e4da;
  border-radius: 50%;
  color: var(--color-primary);
  background: var(--color-primary-soft);
}
.account button {
  border: 0;
  background: transparent;
  color: var(--color-muted);
  padding: 8px;
  font-size: 12px;
}
.page-heading {
  padding: 36px 0 28px;
}
.eyebrow {
  margin: 0 0 10px;
  color: var(--color-primary);
  font-size: 10px;
  letter-spacing: 0.16em;
  font-weight: 700;
}
h1 {
  margin: 0;
  font-size: clamp(24px, 3vw, 32px);
  letter-spacing: -0.025em;
  font-weight: 650;
}
.description {
  margin: 12px 0 0;
  color: var(--color-muted);
  max-width: 72ch;
  font-size: 14px;
}
main {
  padding: clamp(20px, 3vw, 36px);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  box-shadow: var(--shadow-soft);
  animation: workspace-in 320ms var(--ease-out) both;
}
.app-footer {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  padding: 24px 0 32px;
  color: var(--color-muted);
  font-size: 11px;
}
.skip-link {
  position: fixed;
  top: -100px;
  z-index: 20;
  padding: 12px 20px;
  background: white;
}
.skip-link:focus {
  top: 12px;
}
@keyframes workspace-in {
  from {
    opacity: 0;
    transform: translateY(6px);
  }
}
@media (max-width: 900px) {
  .shell {
    width: calc(100% - 40px);
  }
  .app-header {
    gap: 24px;
  }
  .account-name {
    display: none;
  }
}
@media (max-width: 600px) {
  .shell {
    width: calc(100% - 28px);
  }
  .app-header {
    flex-wrap: wrap;
    gap: 0;
    padding-top: 16px;
  }
  .brand {
    font-size: 14px;
  }
  .brand-symbol {
    width: 36px;
    height: 36px;
    font-size: 21px;
  }
  .main-nav {
    order: 3;
    width: 100%;
    height: 52px;
    gap: 28px;
  }
  .avatar {
    display: none;
  }
  .page-heading {
    padding: 26px 2px 20px;
  }
  main {
    padding: 18px;
    border-radius: 16px;
  }
  .app-footer {
    flex-direction: column;
    gap: 4px;
    padding: 20px 2px;
  }
}
</style>
