<!-- [组件导读]
业务名词：Attempt 是一次训练；仿真用逐段台词和角色演出呈现谈判，态势是根据原话证据计算的状态。
用途：在仿真工作台中展示完整文字对话记录。
逻辑：按传入的 messages 区分学生和对手，使用 displayName 标识角色；关闭时向父组件发出 close。
结构：template 描述页面结构；script setup 声明输入、状态和事件；style 定义外观。
为什么：演出显示与已保存训练数据分开，浏览器动画不能充当消息保存或态势计算的成功回执。
[/组件导读] -->
<template>
  <section class="transcript" aria-labelledby="transcript-title">
    <header>
      <div>
        <p>完整文字记录</p>
        <h2 id="transcript-title">本局已确认发言</h2>
      </div>
      <button type="button" @click="$emit('close')">关闭</button>
    </header>
    <ol>
      <li v-for="message in messages" :key="message.id" :class="message.role">
        <strong>{{ message.role === 'student' ? '你' : displayName }}</strong>
        <p>{{ message.content }}</p>
      </li>
    </ol>
  </section>
</template>

<script setup lang="ts">
import type { TrainingMessage } from '@/features/training/types'
defineProps<{ messages: TrainingMessage[]; displayName: string }>()
defineEmits<{ close: [] }>()
</script>

<style scoped>
.transcript {
  position: absolute;
  z-index: 12;
  inset: 10px;
  overflow: auto;
  padding: 20px;
  border: 1px solid var(--color-border);
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.98);
  box-shadow: 0 18px 54px rgba(10, 28, 23, 0.24);
}
header {
  display: flex;
  justify-content: space-between;
  align-items: start;
  position: sticky;
  top: -20px;
  padding: 20px 0 12px;
  background: white;
}
header p,
h2 {
  margin: 0;
}
header p {
  color: var(--color-primary);
  font-size: 0.72rem;
  font-weight: 800;
}
header button {
  min-height: 36px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: white;
}
ol {
  display: grid;
  gap: 10px;
  padding: 0;
  list-style: none;
}
li {
  max-width: 78%;
  padding: 12px 14px;
  border-radius: 12px;
  background: var(--color-canvas);
}
li.student {
  justify-self: end;
  background: var(--color-primary-soft);
}
li strong {
  font-size: 0.72rem;
  color: var(--color-muted);
}
li p {
  margin: 4px 0 0;
  white-space: pre-wrap;
  line-height: 1.55;
}
@media (max-width: 600px) {
  .transcript {
    inset: 0;
    border-radius: 0;
  }
  li {
    max-width: 92%;
  }
}
</style>
