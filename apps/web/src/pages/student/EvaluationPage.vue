<template>
  <RoleWorkspaceLayout title="训练评价" description="先看结论，再回到证据和下一步行动。">
    <p v-if="loading">正在加载正式评价…</p>
    <section v-else-if="attempt?.status === 'evaluation_failed'" class="failure" role="alert">
      <h2>评价生成失败，提交内容没有丢失</h2>
      <p>{{ error ?? '可以直接重试评价，无需重新完成谈判。' }}</p>
      <button type="button" :disabled="submitting" @click="retryAndRefresh">
        {{ submitting ? '正在重试…' : '重试评价' }}
      </button>
    </section>
    <section v-else-if="error" role="alert">
      <p>{{ error }}</p>
      <button @click="reload">重试</button>
    </section>
    <template v-else-if="attempt?.evaluation">
      <EvaluationResultView :evaluation="attempt.evaluation" />
      <nav>
        <RouterLink to="/student">返回学习路线</RouterLink>
        <button type="button" :disabled="submitting" @click="startRetry">
          {{ submitting ? '正在创建…' : '重练本关' }}
        </button>
      </nav>
    </template>
  </RoleWorkspaceLayout>
</template>

<script setup lang="ts">
import { useRoute, useRouter } from 'vue-router'

import RoleWorkspaceLayout from '@/app/layouts/RoleWorkspaceLayout.vue'
import EvaluationResultView from '@/features/evaluation/components/EvaluationResultView.vue'
import { useAttempt } from '@/features/training/composables/useAttempt'

const route = useRoute()
const router = useRouter()
const { attempt, loading, submitting, error, reload, retry, retryTraining } = useAttempt(
  String(route.params.attemptId),
)

async function retryAndRefresh(): Promise<void> {
  await retry()
}

async function startRetry(): Promise<void> {
  const createdId = await retryTraining()
  if (createdId) await router.push(`/student/attempts/${createdId}`)
}
</script>

<style scoped>
.failure {
  padding: var(--space-6);
  border: 1px solid #e2bbb7;
  border-radius: var(--radius-sm);
  background: #fff5f4;
}
.failure h2 {
  margin-top: 0;
}
button {
  min-height: 42px;
  padding: 0 var(--space-4);
  border: 0;
  border-radius: var(--radius-sm);
  color: white;
  background: var(--color-primary);
}
nav {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  margin-top: var(--space-8);
}
nav a {
  color: var(--color-primary);
  font-weight: 700;
}
</style>
