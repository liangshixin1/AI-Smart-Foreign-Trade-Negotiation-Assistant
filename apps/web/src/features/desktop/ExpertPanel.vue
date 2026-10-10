<template>
  <aside v-if="state" class="expert-panel" aria-label="专家体验版">
    <strong
      >{{ state.edition === 'public' ? '公开体验版' : '专家体验版' }} ·
      {{ state.mode === 'mock' ? '样例模型（非真实 AI）' : 'DeepSeek 联网模型' }}</strong
    >
    <span>十阶段 · 本地图谱 · 演示关卡开放</span>
    <span v-if="state.expires_at">授权到期：{{ new Date(state.expires_at).toLocaleString() }}</span>
    <button :disabled="busy" @click="enter('student')">学生体验</button>
    <button :disabled="busy" @click="enter('teacher')">教师体验</button>
    <button :disabled="busy" @click="check">检查三角色连接</button>
    <button @click="help = !help">使用帮助</button>
    <span v-if="state.edition === 'public'">配置 Key：顶部“体验版 → 配置 AI / 更换 Key”</span>
    <p v-if="message" role="status">{{ message }}</p>
    <p v-if="help">
      从学生体验进入课程与知识图谱，选择还盘、付款交货、投诉或索赔相关练习，完成对话后查看评价与历史。教师体验可查看同一体验班的结果。数据保存在本机；样例模型用于检查流程，不代表真实
      AI 表现。故障时使用顶部“体验版”菜单导出诊断。切换角色保留练习记录。
    </p>
  </aside>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/features/auth/stores/auth'
import type { TokenPair } from '@/features/auth/types'
import { homePathForRoles } from '@/features/auth/utils/roleNavigation'
import { request } from '@/shared/api/http'

const router = useRouter()
const auth = useAuthStore()
const state = ref<{ mode: string; edition?: string; expires_at: string | null } | null>(null)
const busy = ref(false)
const help = ref(false)
const message = ref('')
onMounted(async () => {
  if (import.meta.env.VITE_DESKTOP !== 'true') return
  try {
    state.value = await request('/desktop/status')
  } catch {
    /* Ordinary web is unchanged. */
  }
})
async function enter(role: 'student' | 'teacher') {
  busy.value = true
  message.value = ''
  try {
    if (auth.isAuthenticated) await auth.logout()
    auth.applyTokenPair(await request<TokenPair>('/desktop/login/' + role, { method: 'POST' }))
    await router.push(homePathForRoles(auth.user?.roles ?? []))
  } catch {
    message.value = '体验账号暂时不可用，请重试或导出诊断。'
  } finally {
    busy.value = false
  }
}
async function check() {
  busy.value = true
  message.value = '正在检查三种用途，请稍候……'
  try {
    const result = await request<{
      mode: string
      results: { role: string; status: string; category?: string }[]
    }>('/desktop/connectivity', { method: 'POST' })
    message.value =
      (result.mode === 'mock' ? '样例检查：' : '真实联网检查：') +
      result.results
        .map(
          (item) =>
            item.role + ' ' + (item.status === 'ok' ? '通过' : '失败（' + (item.category ?? 'unknown') + '）'),
        )
        .join('；')
  } catch {
    message.value = '连接检查未完成，请检查网络或联系项目组。'
  } finally {
    busy.value = false
  }
}
</script>

<style scoped>
.expert-panel {
  padding: 12px 24px;
  background: #004d40;
  color: white;
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
  font-size: 13px;
}
button {
  background: white;
  color: #004d40;
  border: none;
  padding: 7px 12px;
  border-radius: 6px;
  cursor: pointer;
}
button:disabled {
  opacity: 0.6;
}
p {
  flex-basis: 100%;
  margin: 0;
  line-height: 1.7;
}
</style>
