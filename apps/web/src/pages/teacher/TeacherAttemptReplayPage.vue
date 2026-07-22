<template>
  <RoleWorkspaceLayout
    title="训练证据回放"
    description="场景、学生表达、逐轮反馈和正式评价在同一条证据链中。"
  >
    <RouterLink to="/teacher">← 返回班级总览</RouterLink>
    <p v-if="error" role="alert" class="error">{{ error }}</p>
    <template v-if="replay">
      <dl class="provenance">
        <div>
          <dt>课程版本</dt>
          <dd>{{ replay.course_version_id }}</dd>
        </div>
        <div v-for="(value, key) in replay.content_bindings" :key="key">
          <dt>{{ key }}</dt>
          <dd>{{ value }}</dd>
        </div>
      </dl>
      <ScenarioBrief
        v-if="replay.attempt.scenario"
        :scenario="replay.attempt.scenario"
        :collapsible="false"
      />
      <section>
        <h2>完整训练记录</h2>
        <ConversationTimeline
          :messages="replay.attempt.messages"
          :evaluations="replay.attempt.round_evaluations"
        />
      </section>
      <EvaluationResultView
        v-if="replay.attempt.evaluation"
        :evaluation="replay.attempt.evaluation"
      />
      <p v-else class="empty">本次训练尚未形成正式评价。</p>
      <LearnerDevelopmentDiagnostic
        :rounds="replay.round_learning_diagnostics"
        :final-diagnostic="replay.final_learning_diagnostic"
      />
      <KnowledgeEvidenceReplay
        :interactions="replay.scaffold_interactions"
        :evidence="replay.graph_learning_evidence"
      />
    </template>
  </RoleWorkspaceLayout>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import RoleWorkspaceLayout from '@/app/layouts/RoleWorkspaceLayout.vue'
import { useAuthStore } from '@/features/auth/stores/auth'
import EvaluationResultView from '@/features/evaluation/components/EvaluationResultView.vue'
import { teacherApi, type AttemptReplay } from '@/features/teacher-dashboard/api/teacherApi'
import LearnerDevelopmentDiagnostic from '@/features/teacher-dashboard/components/LearnerDevelopmentDiagnostic.vue'
import ConversationTimeline from '@/features/training/components/ConversationTimeline.vue'
import ScenarioBrief from '@/features/training/components/ScenarioBrief.vue'
import { KnowledgeEvidenceReplay } from '@/features/knowledge-graph/teacherEvidence'

const auth = useAuthStore()
const route = useRoute()
const replay = ref<AttemptReplay | null>(null)
const error = ref<string | null>(null)
onMounted(async () => {
  if (!auth.accessToken) return
  try {
    replay.value = await teacherApi.attemptReplay(auth.accessToken, String(route.params.attemptId))
  } catch (e) {
    error.value = e instanceof Error ? e.message : '加载失败'
  }
})
</script>

<style scoped>
.error {
  color: var(--color-danger);
}
.provenance {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-4);
  margin: var(--space-5) 0;
  padding: var(--space-4);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-canvas);
}
.provenance div {
  display: grid;
  gap: 2px;
}
.provenance dt {
  color: var(--color-muted);
  font-size: 0.75rem;
}
.provenance dd {
  margin: 0;
  font-size: 0.8rem;
}
section {
  margin-top: var(--space-6);
}
section:has(.timeline) {
  overflow: hidden;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
}
section:has(.timeline) h2 {
  margin: 0;
  padding: var(--space-4) var(--space-6);
  border-bottom: 1px solid var(--color-border);
}
.empty {
  color: var(--color-muted);
}
</style>
