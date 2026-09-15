<!-- [组件导读]
业务名词：工作区是按学生、教师和技术人员区分的业务页面。
用途：显示角色工作区与服务连接检查的状态。
逻辑：使用 useWorkspaceProbe 提供的状态组织加载、成功和失败提示；具体接口与登录信息处理沿该组合函数阅读。
结构：template 描述页面结构；script setup 声明输入、状态和事件；style 定义外观。
阅读线索：状态入口 useWorkspaceProbe。
为什么：角色工作区需要可解释的连接失败状态，避免把服务不可用误认为没有业务数据。
[/组件导读] -->
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
