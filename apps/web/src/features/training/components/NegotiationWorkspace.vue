<!-- [组件导读]
业务名词：Attempt 是一次训练记录；场景是本次任务与约束，逐轮反馈是单轮建议，正式评价在确认提交后形成。
用途：谈判模式下的工作台入口，使用通用训练布局。
逻辑：把 attempt、发送状态与回调传给 TrainingWorkspaceShell，并同步 draft；业务请求集中在外层状态模块。
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
