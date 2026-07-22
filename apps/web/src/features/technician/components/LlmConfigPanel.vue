<template>
  <section class="llm-panel" aria-labelledby="llm-config-title">
    <div>
      <span class="eyebrow">三 AGENT 配置</span>
      <h2 id="llm-config-title">大模型连接</h2>
      <p>密钥只写入服务端环境，页面永不回显。</p>
    </div>
    <p v-if="message" :class="{ error: failed }" role="status">{{ message }}</p>
    <form v-if="config" class="config" @submit.prevent="save">
      <label>API 基址<input v-model="form.base_url" type="url" required /></label>
      <div class="row">
        <label>
          超时（秒）
          <input v-model.number="form.timeout_seconds" type="number" min="5" max="180" />
        </label>
        <label>
          重试次数
          <input v-model.number="form.max_retries" type="number" min="0" max="3" />
        </label>
      </div>
      <fieldset v-for="agent in config.agents" :key="agent.purpose">
        <legend>
          {{ labels[agent.purpose] }} Agent
          <span>{{ agent.configured ? '已配置 Key' : '未配置' }}</span>
        </legend>
        <label>模型<input v-model="form[`${agent.purpose}_model`]" /></label>
        <label>
          替换 API Key
          <input
            v-model="form[`${agent.purpose}_api_key`]"
            type="password"
            autocomplete="new-password"
            placeholder="留空表示不替换"
          />
        </label>
        <button type="button" @click="test(agent.purpose)">测试连接</button>
      </fieldset>
      <button type="submit" class="primary">保存并立即应用</button>
    </form>
  </section>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'

import { useAuthStore } from '@/features/auth/stores/auth'
import {
  technicianApi,
  type ConfigInput,
  type LlmConfig,
} from '@/features/technician/api/technicianApi'

const auth = useAuthStore()
const config = ref<LlmConfig | null>(null)
const message = ref('')
const failed = ref(false)
const labels = { scenario: '场景生成', conversation: '模拟对话', evaluation: 'AI 评价' } as const
const form = reactive<Required<ConfigInput>>({
  base_url: '',
  timeout_seconds: 60,
  max_retries: 1,
  scenario_model: '',
  conversation_model: '',
  evaluation_model: '',
  scenario_api_key: '',
  conversation_api_key: '',
  evaluation_api_key: '',
})
async function load(): Promise<void> {
  if (!auth.accessToken) return
  try {
    config.value = await technicianApi.get(auth.accessToken)
    Object.assign(form, {
      base_url: config.value.base_url,
      timeout_seconds: config.value.timeout_seconds,
      max_retries: config.value.max_retries,
      ...Object.fromEntries(config.value.agents.map((a) => [`${a.purpose}_model`, a.model])),
    })
  } catch (error) {
    show(error, true)
  }
}
async function save(): Promise<void> {
  if (!auth.accessToken) return
  try {
    const payload: ConfigInput = {
      base_url: form.base_url,
      timeout_seconds: form.timeout_seconds,
      max_retries: form.max_retries,
      scenario_model: form.scenario_model,
      conversation_model: form.conversation_model,
      evaluation_model: form.evaluation_model,
      ...(form.scenario_api_key ? { scenario_api_key: form.scenario_api_key } : {}),
      ...(form.conversation_api_key ? { conversation_api_key: form.conversation_api_key } : {}),
      ...(form.evaluation_api_key ? { evaluation_api_key: form.evaluation_api_key } : {}),
    }
    config.value = await technicianApi.save(auth.accessToken, payload)
    show('配置已安全保存并应用。', false)
  } catch (error) {
    show(error, true)
  }
}
async function test(purpose: string): Promise<void> {
  if (!auth.accessToken) return
  try {
    const result = await technicianApi.test(auth.accessToken, purpose)
    show(
      `${labels[purpose as keyof typeof labels]} Agent 连接成功：${result.model}，${String(result.total_tokens)} tokens`,
      false,
    )
  } catch (error) {
    show(error, true)
  }
}
function show(value: unknown, isError: boolean): void {
  message.value = value instanceof Error ? value.message : String(value)
  failed.value = isError
}
onMounted(load)
</script>

<style scoped>
.llm-panel {
  display: grid;
  gap: var(--space-4);
  padding: clamp(1rem, 2.5vw, 2rem);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: white;
  box-shadow: var(--shadow-sm);
}
.eyebrow {
  color: var(--color-primary);
  font-size: 0.75rem;
  font-weight: 750;
  letter-spacing: 0.08em;
}
h2,
p {
  margin: 0.2rem 0 0;
}
.llm-panel > div > p {
  color: var(--color-muted);
}
.config {
  display: grid;
  gap: var(--space-4);
  max-width: 860px;
}
.config label {
  display: grid;
  gap: var(--space-1);
}
input,
button {
  min-height: 42px;
  padding: 0 var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: white;
}
.row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-3);
}
fieldset {
  display: grid;
  grid-template-columns: 1fr 1fr auto;
  gap: var(--space-3);
  padding: var(--space-4);
  border: 1px solid var(--color-border);
}
legend span {
  color: var(--color-muted);
  font-size: 0.8rem;
}
.primary {
  color: white;
  background: var(--color-primary);
}
.error {
  color: var(--color-danger);
}
@media (max-width: 700px) {
  fieldset,
  .row {
    grid-template-columns: 1fr;
  }
}
</style>
