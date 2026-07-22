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
