<!-- [组件导读]
业务名词：Attempt 是一次训练记录；学生负责练习，教师查看所属班级学情，技术人员维护平台运行配置。
用途：用户访问无权限页面时显示拒绝访问提示和返回入口。
逻辑：权限判定在路由守卫和后端完成，本组件负责解释结果并提供导航。
结构：template 描述页面结构；script setup 声明输入、状态和事件；style 定义外观。
阅读线索：状态入口 useAuthStore。
为什么：把页面组合与数据处理分开，方便沿调用关系定位问题；页面显示成功需以实际请求结果为准。
[/组件导读] -->
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
