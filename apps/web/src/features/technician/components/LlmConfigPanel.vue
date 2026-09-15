<!-- [组件导读]
业务名词：变更集是待评审的图谱改动；发布版是通过评审后可读取的图数据，模型配置按生成场景、对话和评价分用途。
用途：技术人员维护场景生成、模拟对话和评价三类模型配置的面板。
逻辑：挂载时读取配置并填表；保存仅在密钥输入非空时提交对应密钥字段，测试按钮按用途调用后端连接测试。
结构：template 描述页面结构；script setup 声明输入、状态和事件；style 定义外观。
阅读线索：状态入口 useAuthStore。
为什么：空密钥输入表示未提供新值；只有非空字段才发送，防止保存普通配置时意外清空凭据。
[/组件导读] -->
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
// [导读] 带登录令牌读取现有配置，并将各用途的模型名回填到表单。
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
// [导读] 组装配置请求；密钥留空时不提交该字段，避免把留空误当成覆盖现有密钥。
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
// [导读] 按用途调用连接测试，并展示所用模型及测试返回的 token 数量。
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
// [导读] 统一把异常或普通结果转换为提示文案，并设置成功或失败样式。
function show(value: unknown, isError: boolean): void {
  message.value = value instanceof Error ? value.message : String(value)
  failed.value = isError
}
onMounted(load)
</script>

<style scoped>
.llm-panel {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
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
  grid-template-columns: minmax(0, 1fr);
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
  min-inline-size: 0;
  border-radius: var(--radius-sm);
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) auto;
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
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
