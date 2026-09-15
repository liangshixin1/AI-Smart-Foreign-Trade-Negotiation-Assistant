<!-- [组件导读]
业务名词：Attempt 是一次训练记录；学生负责练习，教师查看所属班级学情，技术人员维护平台运行配置。
用途：学生正式评价页，组织加载、失败重试、评价内容和后续学习入口。
逻辑：useAttempt 提供训练与重试动作；重新评价沿用当前记录，重新训练会创建新记录并跳转到新的训练编号。
结构：template 描述页面结构；script setup 声明输入、状态和事件；style 定义外观。
阅读线索：子组件 LcCorrectionWorkspace、RoleWorkspaceLayout、EvaluationResultView、EvaluationLearningPath、EvaluationKnowledgeGraph；状态入口 useRoute、useRouter、useAttempt。
为什么：把页面组合与数据处理分开，方便沿调用关系定位问题；页面显示成功需以实际请求结果为准。
[/组件导读] -->
<template>
  <LcCorrectionWorkspace
    v-if="attempt?.workspace_kind === 'lc_correction'"
    :attempt-id="attempt.id"
  />
  <RoleWorkspaceLayout v-else title="训练评价" description="先看结论，再回到证据和下一步行动。">
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
      <EvaluationKnowledgeGraph
        :attempt-id="String(route.params.attemptId)"
        :evaluations="attempt.round_evaluations"
      />
      <EvaluationLearningPath :evaluations="attempt.round_evaluations" />
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
import LcCorrectionWorkspace from '@/features/document-correction/components/LcCorrectionWorkspace.vue'
import { useRoute, useRouter } from 'vue-router'

import RoleWorkspaceLayout from '@/app/layouts/RoleWorkspaceLayout.vue'
import EvaluationResultView from '@/features/evaluation/components/EvaluationResultView.vue'
import EvaluationLearningPath from '@/features/knowledge-graph/components/EvaluationLearningPath.vue'
import EvaluationKnowledgeGraph from '@/features/knowledge-graph/components/EvaluationKnowledgeGraph.vue'
import { useAttempt } from '@/features/training/composables/useAttempt'

const route = useRoute()
const router = useRouter()
const { attempt, loading, submitting, error, reload, retry, retryTraining } = useAttempt(
  String(route.params.attemptId),
)

// [导读] 调用当前训练的评价重试，结果更新由 useAttempt 管理。
async function retryAndRefresh(): Promise<void> {
  await retry()
}

// [导读] 创建新的重练记录；仅在拿到新编号后跳转，保留旧训练可供回放。
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
