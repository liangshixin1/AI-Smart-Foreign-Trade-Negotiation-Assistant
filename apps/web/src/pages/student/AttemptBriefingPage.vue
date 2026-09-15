<!-- [组件导读]
业务名词：Attempt 是一次训练记录；学生负责练习，教师查看所属班级学情，技术人员维护平台运行配置。
用途：训练开始前展示局面简报，并按体验模式提供文字或仿真开场。
逻辑：根据路由中的训练编号恢复训练和仿真数据；用户确认进入后跳到工作台，工作台模式选择由目标训练页完成。
结构：template 描述页面结构；script setup 声明输入、状态和事件；style 定义外观。
阅读线索：子组件 RoleWorkspaceLayout、KnowledgeGraphPhaseView、BriefingPlayer；状态入口 useRoute、useRouter、useAttempt、useSimulationSession、useAttemptScaffold、useStudentKnowledgeGraph、useStudentKnowledgeInsights。
为什么：先让学生理解公开局面再作答；图谱与简报来自该次训练，不能把新发布内容当作历史开场。
[/组件导读] -->
<template>
  <RoleWorkspaceLayout title="局面简报" description="先建立今天的谈判地图，再进入实时对话。">
    <p v-if="pageLoading" class="state">正在还原本场局面…</p>
    <p v-else-if="pageError" class="state error" role="alert">
      {{ pageError }}
    </p>
    <template v-else-if="attempt?.scenario && attempt.experience_mode === 'simulation'">
      <BriefingPlayer
        v-if="simulation"
        :briefing="simulation.briefing"
        :briefing-status="simulation.briefing_status"
        :display-name="simulation.display_name"
        @enter="enterWorkspace"
      />
      <p v-else class="state" role="alert">{{ simulationError || '正在恢复情境简报…' }}</p>
    </template>
    <template v-else-if="attempt?.scenario && scaffold && graph">
      <section class="briefing-grid">
        <article class="scenario-card">
          <p>今日任务</p>
          <h2>{{ attempt.scenario.scenario_title }}</h2>
          <span>{{ attempt.scenario.scenario_summary }}</span>
          <dl>
            <div>
              <dt>你的角色</dt>
              <dd>{{ attempt.scenario.student_role }}</dd>
            </div>
            <div>
              <dt>谈判对手</dt>
              <dd>{{ attempt.scenario.ai_role }}</dd>
            </div>
            <div>
              <dt>任务成果</dt>
              <dd>{{ attempt.scenario.student_task }}</dd>
            </div>
          </dl>
        </article>
        <article class="focus-card">
          <p>进入谈判前</p>
          <h2>记住三个方向</h2>
          <ol>
            <li v-for="target in attempt.scenario.negotiation_targets.slice(0, 3)" :key="target">
              {{ target }}
            </li>
          </ol>
          <button type="button" @click="enterWorkspace">进入谈判工作台</button>
          <small>训练中地图会自动收敛为低干扰的知识罗盘。</small>
        </article>
      </section>
      <KnowledgeGraphPhaseView
        :graph="graph"
        :overlay="overlay"
        eyebrow="今日局面地图"
        title="完整流程中，本场训练位于哪里"
        description="完整阶段地图保持原位；清晰节点是本场重点，红色外圈提示来自既往训练的关注项。"
        size="large"
        content-base="/student/knowledge/"
      />
    </template>
  </RoleWorkspaceLayout>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import RoleWorkspaceLayout from '@/app/layouts/RoleWorkspaceLayout.vue'
import KnowledgeGraphPhaseView from '@/features/knowledge-graph/components/KnowledgeGraphPhaseView.vue'
import { useAttemptScaffold } from '@/features/knowledge-graph/composables/useAttemptScaffold'
import { useStudentKnowledgeGraph } from '@/features/knowledge-graph/composables/useStudentKnowledgeGraph'
import { useStudentKnowledgeInsights } from '@/features/knowledge-graph/composables/useStudentKnowledgeInsights'
import { briefingOverlay } from '@/features/knowledge-graph/graphOverlay'
import { useAttempt } from '@/features/training/composables/useAttempt'
import BriefingPlayer from '@/features/simulation/components/BriefingPlayer.vue'
import { useSimulationSession } from '@/features/simulation/composables/useSimulationSession'

const route = useRoute()
const router = useRouter()
const attemptId = String(route.params.attemptId)
const { attempt, loading, error } = useAttempt(attemptId)
const isSimulation = computed(() => attempt.value?.experience_mode === 'simulation')
const { session: simulation, error: simulationError } = useSimulationSession(
  attemptId,
  isSimulation,
)
const { scaffold, loading: scaffoldLoading, error: scaffoldError } = useAttemptScaffold(attemptId)
const { graph, loading: graphLoading, error: graphError } = useStudentKnowledgeGraph(attemptId)
const { insights } = useStudentKnowledgeInsights()
const pageLoading = computed(
  () => loading.value || (!isSimulation.value && (scaffoldLoading.value || graphLoading.value)),
)
const pageError = computed(() =>
  isSimulation.value
    ? error.value || simulationError.value
    : error.value || scaffoldError.value || graphError.value,
)
const overlay = computed(() =>
  graph.value && scaffold.value
    ? briefingOverlay(graph.value, scaffold.value, insights.value)
    : {
        audience: 'student' as const,
        phase: 'briefing' as const,
        revision: '',
        nodes: [],
        edges: [],
      },
)

// [导读] 沿当前 attemptId 进入工作台，复用已有场景记录而不是再次创建训练。
async function enterWorkspace(): Promise<void> {
  await router.push({ name: 'training-workspace', params: { attemptId } })
}
</script>

<style scoped>
.state {
  color: var(--color-muted);
}
.error {
  color: var(--color-danger);
}
.briefing-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.5fr) minmax(280px, 0.75fr);
  gap: var(--space-4);
  margin-bottom: var(--space-5);
}
.scenario-card,
.focus-card {
  padding: var(--space-5);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: #f8fbf9;
}
.scenario-card > p,
.focus-card > p {
  margin: 0;
  color: var(--color-primary);
  font-size: 0.75rem;
  font-weight: 800;
}
h2 {
  margin: var(--space-1) 0 var(--space-2);
}
.scenario-card > span,
.focus-card small {
  color: var(--color-muted);
  line-height: 1.55;
}
dl {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--space-3);
  margin: var(--space-4) 0 0;
}
dt {
  color: var(--color-muted);
  font-size: 0.72rem;
}
dd {
  margin: 4px 0 0;
  font-weight: 700;
  line-height: 1.45;
}
ol {
  padding-left: var(--space-5);
  line-height: 1.6;
}
.focus-card button {
  width: 100%;
  min-height: 44px;
  margin: var(--space-2) 0;
  border: 0;
  border-radius: var(--radius-sm);
  color: white;
  background: var(--color-primary);
  cursor: pointer;
}
@media (max-width: 820px) {
  .briefing-grid,
  dl {
    grid-template-columns: 1fr;
  }
}
</style>
