<template>
  <RoleWorkspaceLayout
    title="训练证据回放"
    description="场景、学生表达、逐轮反馈和正式评价在同一条证据链中。"
  >
    <RouterLink to="/teacher">← 返回班级总览</RouterLink>
    <p v-if="error" role="alert" class="error">{{ error }}</p>
    <template v-if="replay">
      <p class="mode-badge">
        {{ replay.attempt.experience_mode === 'simulation' ? '仿真模式' : '对话模式' }}
      </p>
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
          :selectable-rounds="true"
          :selected-round-id="selectedRoundId"
          @select-round="selectedRoundId = $event"
        />
      </section>
      <section v-if="replay.simulation" class="simulation-evidence">
        <h2>仿真演出与谈判态势</h2>
        <p>
          配置 {{ replay.simulation.profile_id }} · {{ replay.simulation.profile_version }}； 资产
          {{ replay.simulation.asset_pack_version }}；态势规则
          {{ replay.simulation.latest_state.rules_version }}。
        </p>
        <dl>
          <div>
            <dt>沟通信任</dt>
            <dd>{{ replay.simulation.latest_state.trust.value }}</dd>
          </div>
          <div>
            <dt>合作意愿</dt>
            <dd>{{ replay.simulation.latest_state.willingness.value }}</dd>
          </div>
          <div>
            <dt>条款共识</dt>
            <dd>
              {{ replay.simulation.latest_state.alignment.confirmed }}/{{
                replay.simulation.latest_state.alignment.required
              }}
            </dd>
          </div>
        </dl>
        <ol>
          <li v-for="turn in replay.simulation.turns" :key="turn.presentation_id">
            <strong>第 {{ turn.conversation_revision }} 轮：</strong>
            {{ turn.beats.map((beat) => beat.text).join(' ') }}
          </li>
        </ol>
        <h3>态势变化与原话证据</h3>
        <ol class="state-history">
          <li v-for="state in replay.simulation.state_history" :key="state.revision">
            <strong>版本 {{ state.revision }}</strong>
            <span>
              信任 {{ state.trust.value }} · 意愿 {{ state.willingness.value }} · 共识
              {{ state.alignment.confirmed }}/{{ state.alignment.required }}
            </span>
            <ul v-if="state.public_changes.length">
              <li v-for="change in state.public_changes" :key="change.event_id">
                {{ change.label }}：{{ change.reason }}
                <blockquote v-for="item in change.evidence" :key="item.message_id">
                  “{{ item.quote }}”
                </blockquote>
              </li>
            </ul>
            <span v-else>初始状态，无变化事件。</span>
          </li>
        </ol>
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
      <TeacherAttemptKnowledgeGraph
        v-model:selected-round-id="selectedRoundId"
        :attempt-id="String(route.params.attemptId)"
        :evidence="replay.graph_learning_evidence"
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
import TeacherAttemptKnowledgeGraph from '@/features/knowledge-graph/components/TeacherAttemptKnowledgeGraph.vue'

const auth = useAuthStore()
const route = useRoute()
const replay = ref<AttemptReplay | null>(null)
const error = ref<string | null>(null)
const selectedRoundId = ref<string | null>(null)
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
.mode-badge {
  display: inline-flex;
  margin: var(--space-4) 0 0;
  padding: 4px 10px;
  border-radius: 999px;
  color: var(--color-primary-strong);
  background: var(--color-primary-soft);
  font-size: 0.78rem;
  font-weight: 800;
}
.simulation-evidence {
  padding: var(--space-5);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-canvas);
}
.simulation-evidence dl {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--space-3);
}
.simulation-evidence dd {
  margin: 4px 0 0;
  font-weight: 800;
}
.state-history {
  display: grid;
  gap: var(--space-3);
}
.state-history > li {
  display: grid;
  gap: 4px;
}
.state-history blockquote {
  margin: 4px 0 0;
  padding-left: 10px;
  border-left: 2px solid var(--color-border);
  color: var(--color-muted);
  overflow-wrap: anywhere;
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
