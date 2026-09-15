<!-- [组件导读]
业务名词：Attempt 是一次训练记录；场景是本次任务与约束，逐轮反馈是单轮建议，正式评价在确认提交后形成。
用途：为普通单证审阅训练配置专用标题与输入提示。
逻辑：复用 TrainingWorkspaceShell 的对话、简报和支持区；向其传入 attempt、发送回调及双向草稿。这与信用证专用审改工作台是两个入口。
结构：template 描述页面结构；script setup 声明依赖与逻辑，外观沿用共享样式。
阅读线索：子组件 TrainingWorkspaceShell。
为什么：展示组件共用训练状态，避免各界面各自修改完成或评价结果；状态是否可操作由后端再次核对。
[/组件导读] -->
<template>
  <TrainingWorkspaceShell
    v-model:draft="draft"
    :attempt="attempt"
    :sending="sending"
    :send-message="sendMessage"
    workspace-label="单证审阅工作台"
    workspace-hint="按“问题—风险—修改”提交"
    composer-label="审阅意见"
    placeholder="列出条款位置、不符点、风险与改证建议…"
  />
</template>
<script setup lang="ts">
import type { Attempt } from '../types'
import TrainingWorkspaceShell from './TrainingWorkspaceShell.vue'
defineProps<{
  attempt: Attempt & { scenario: NonNullable<Attempt['scenario']> }
  sending: boolean
  sendMessage: (content: string) => Promise<boolean>
}>()
const draft = defineModel<string>('draft', { required: true })
</script>
