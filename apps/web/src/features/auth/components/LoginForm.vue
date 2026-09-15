<!-- [组件导读]
业务名词：角色分学生、教师和技术人员；访问令牌用于调用接口，刷新令牌用于在登录有效期内换取新令牌。
用途：收集邮箱或学号与密码，并显示登录中的状态及错误。
逻辑：输入保存在本地 ref 中；点击提交时向父页面发送 submit 事件，真正的认证请求由父页面处理。
结构：template 描述页面结构；script setup 声明输入、状态和事件；style 定义外观。
为什么：输入、会话和导航分层，便于处理认证失败；前端角色判断只管理界面，后端才是权限依据。
[/组件导读] -->
<template>
  <form class="login-form" @submit.prevent="submit">
    <div class="field">
      <label for="identifier">邮箱或学号</label>
      <input
        id="identifier"
        v-model.trim="identifier"
        name="identifier"
        autocomplete="username"
        required
        autofocus
      />
    </div>
    <div class="field">
      <label for="password">密码</label>
      <input
        id="password"
        v-model="password"
        name="password"
        type="password"
        autocomplete="current-password"
        minlength="8"
        required
      />
    </div>
    <p v-if="errorMessage" class="error" role="alert">{{ errorMessage }}</p>
    <button type="submit" :disabled="submitting">
      {{ submitting ? '正在登录…' : '登录' }}
    </button>
  </form>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const props = defineProps<{
  submitting: boolean
  errorMessage: string
}>()

const emit = defineEmits<{
  submit: [credentials: { identifier: string; password: string }]
}>()

const identifier = ref('')
const password = ref('')

// [导读] 正在提交时直接返回，防止重复触发；否则把两项输入一次性交给父页面。
function submit(): void {
  if (props.submitting) return
  emit('submit', { identifier: identifier.value, password: password.value })
}
</script>

<style scoped>
.login-form {
  display: grid;
  gap: var(--space-4);
}

.field {
  display: grid;
  gap: var(--space-2);
}

label {
  color: var(--color-muted);
  font-size: 0.9rem;
  font-weight: 650;
}

input {
  min-height: 44px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  padding: 0 var(--space-3);
  color: var(--color-ink);
  background: var(--color-surface);
}

button {
  min-height: 46px;
  border: 0;
  border-radius: var(--radius-sm);
  color: white;
  background: var(--color-primary);
  font-weight: 700;
  cursor: pointer;
}

button:hover:not(:disabled) {
  background: var(--color-primary-strong);
}

button:disabled {
  cursor: wait;
  opacity: 0.7;
}

.error {
  margin: 0;
  color: var(--color-danger);
  font-size: 0.9rem;
}
</style>
