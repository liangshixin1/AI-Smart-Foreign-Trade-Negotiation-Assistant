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
