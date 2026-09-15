<!-- [组件导读]
业务名词：信用证是银行按约定单据付款的承诺；MT700 是本项目的信用证报文样式；批注是学生提出的改证意见。
用途：在技术人员工作区展示信用证审改功能的环境检查结果。
逻辑：挂载时调用受认证保护的状态接口，读取功能开关、数据库迁移和配置准备情况；失败时显示连接提示。
结构：template 描述页面结构；script setup 声明输入、状态和事件；style 定义外观。
阅读线索：状态入口 useAuthStore。
为什么：把原证、批注和成绩分开，才能解释每项改证依据；可编辑状态仍需后端校验。
[/组件导读] -->
<template>
  <section>
    <h2>信用证审改模式 · 环境状态</h2>
    <p v-if="error" role="alert">{{ error }}</p>
    <template v-if="status"
      ><p>{{ status.message }}</p>
      <p>
        功能开关：{{ status.enabled ? '已开启' : '已关闭' }} · 数据库：{{
          status.database_heads.join(', ') || '尚未迁移'
        }}
        · 内容：{{ status.profile_ready ? '已就绪' : '未就绪' }}
      </p>
      <p v-if="status.missing_tables.length">
        缺少表：{{ status.missing_tables.join(', ') }}
      </p></template
    ><button type="button" @click="load">重新检查</button>
  </section>
</template>
<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { request } from '@/shared/api/http'
import { useAuthStore } from '@/features/auth/stores/auth'
const auth = useAuthStore(),
  error = ref('')
const status = ref<{
  message: string
  enabled: boolean
  database_heads: string[]
  profile_ready: boolean
  missing_tables: string[]
} | null>(null)
// [导读] 读取技术人员的环境状态接口；捕获连接错误并转成界面提示。
async function load() {
  try {
    status.value = await request(
      '/api/v1/technician/document-correction/status',
      {},
      auth.accessToken ?? '',
    )
  } catch {
    error.value = '环境检查失败，请检查服务连接。'
  }
}
onMounted(load)
</script>
<style scoped>
section {
  padding: 20px;
  margin-bottom: 20px;
  border: 1px solid #d1ddd3;
  border-radius: 10px;
  background: #f7faf6;
}
button {
  padding: 10px;
}
</style>
