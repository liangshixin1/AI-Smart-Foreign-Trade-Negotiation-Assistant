<!-- [组件导读]
业务名词：Attempt 是一次训练记录；学生负责练习，教师查看所属班级学情，技术人员维护平台运行配置。
用途：登录页面，组合品牌介绍、登录表单和登录后的角色跳转。
逻辑：认证操作交给 auth store；成功后跳到对应角色首页，表单只负责收集输入和呈现提交状态。
结构：template 描述页面结构；script setup 声明输入、状态和事件；style 定义外观。
阅读线索：子组件 LoginForm；状态入口 useAuthStore、useRouter。
为什么：把页面组合与数据处理分开，方便沿调用关系定位问题；页面显示成功需以实际请求结果为准。
[/组件导读] -->
<template>
  <main class="login-page">
    <section class="intro" aria-labelledby="platform-title">
      <p class="eyebrow"><span class="brand-mark" aria-hidden="true">N↗</span> NEGOTIATION LAB</p>
      <h1 id="platform-title">每一次交锋，<br />都离从容更近一步。</h1>
      <p class="intro-copy">
        AI 智能外贸谈判训练平台<br />在真实商务情境中练习，让知识成为你的谈判底气。
      </p>
      <div class="learning-path" aria-label="学习流程">
        <span>01 <b>理解情境</b></span
        ><i aria-hidden="true">→</i><span>02 <b>实战谈判</b></span
        ><i aria-hidden="true">→</i><span>03 <b>复盘成长</b></span>
      </div>
      <p>©AI赋能：智能时代的外贸谈判策略与实战 项目组</p>
    </section>
    <section class="panel" aria-labelledby="login-title">
      <p class="panel-kicker">YOUR NEXT CHAPTER</p>
      <h2 id="login-title">欢迎回来</h2>
      <p>登录账号，继续你的学习与教学。</p>
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

// [导读] 等待认证成功后按角色跳转；无论成功失败都在 finally 清除提交状态，避免表单一直锁定。
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
  grid-template-columns: minmax(0, 1fr) minmax(320px, 400px);
  align-items: center;
  gap: clamp(48px, 8vw, 120px);
  width: min(1120px, calc(100% - 80px));
  min-height: 100svh;
  margin: 0 auto;
  padding: 64px 0;
}
.intro {
  max-width: 640px;
}
.eyebrow {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 0 0 52px;
  color: var(--color-primary);
  font-size: 11px;
  font-weight: 750;
  letter-spacing: 0.18em;
}
.brand-mark {
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  border-radius: 12px;
  background: var(--color-primary);
  color: white;
  font-size: 20px;
  letter-spacing: -0.08em;
}
h1 {
  margin: 0;
  font-size: clamp(30px, 3.7vw, 48px);
  line-height: 1.5;
  font-weight: 600;
  letter-spacing: -0.045em;
}
.intro-copy {
  margin: 24px 0 32px;
  color: var(--color-muted);
  line-height: 1.9;
}
.learning-path {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 24px 0;
  border-top: 1px solid var(--color-border);
  border-bottom: 1px solid var(--color-border);
  font-size: 11px;
  color: var(--color-primary);
}
.learning-path span {
  display: grid;
  gap: 5px;
  letter-spacing: 0.04em;
}
.learning-path b {
  font-size: 13px;
  color: var(--color-ink);
  font-weight: 550;
}
.learning-path i {
  flex: 1;
  text-align: center;
  color: #a3b7ad;
  font-style: normal;
}
.intro > p:last-child {
  margin: 28px 0 0;
  color: var(--color-muted);
  font-size: 10px;
}
.panel {
  padding: 40px 32px;
  border: 1px solid var(--color-border);
  border-radius: 22px;
  background: var(--color-surface);
  box-shadow: 0 12px 48px rgb(25 52 42 / 5%);
  animation: enter 400ms var(--ease-out) both;
}
.panel .panel-kicker {
  margin: 0 0 12px;
  color: var(--color-primary);
  font-size: 9px;
  letter-spacing: 0.16em;
}
.panel h2 {
  margin: 0;
  font-size: 27px;
  font-weight: 600;
}
.panel > p {
  margin: 12px 0 32px;
  color: var(--color-muted);
  font-size: 13px;
}
@keyframes enter {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
}
@media (max-width: 760px) {
  .login-page {
    width: min(480px, calc(100% - 40px));
    grid-template-columns: 1fr;
    gap: 30px;
    padding: 32px 0;
  }
  .eyebrow {
    margin-bottom: 28px;
  }
  h1 {
    font-size: clamp(28px, 7vw, 38px);
  }
  .intro-copy {
    margin: 16px 0 0;
    font-size: 13px;
  }
  .learning-path {
    margin-top: 22px;
    padding: 16px 0;
  }
  .intro > p:last-child {
    display: none;
  }
  .panel {
    padding: 28px 24px;
  }
}
</style>
