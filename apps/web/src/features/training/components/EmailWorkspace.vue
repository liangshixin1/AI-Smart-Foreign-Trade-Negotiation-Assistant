<!-- [组件导读]
业务名词：Attempt 是一次训练记录；场景是本次任务与约束，逐轮反馈是单轮建议，正式评价在确认提交后形成。
用途：为商务邮件训练配置专用工作台标题和邮件输入提示。
逻辑：复用 TrainingWorkspaceShell，通过属性调整文案；草稿和发送函数由外层传入，通用消息与保存流程共用。
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
    workspace-label="商务邮件工作台"
    workspace-hint="使用英文完成当前任务"
    composer-label="英文商务邮件"
    placeholder="输入邮件正文（称呼、任务要点、结尾）…"
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
