<template>
  <section class="diagnostic-panel" aria-labelledby="diagnostic-title">
    <header>
      <div>
        <p class="eyebrow">仅教师可见 · 动态评价</p>
        <h2 id="diagnostic-title">学习者发展诊断</h2>
      </div>
      <span class="framework">ZPD · i+1</span>
    </header>
    <p class="intro">
      这里观察学生独立表现与接受帮助后的潜在表现，用于调整下一轮挑战，不参与系统完成判定。
    </p>

    <template v-if="finalDiagnostic">
      <div class="summary-cards">
        <article>
          <span>发展阶段</span><strong>{{ stageLabel(finalDiagnostic.learner_stage) }}</strong>
        </article>
        <article>
          <span>建议挑战</span><strong>{{ finalDiagnostic.challenge_level }} / 4</strong>
        </article>
        <article>
          <span>最低帮助</span><strong>{{ supportLabel(finalDiagnostic.support_level) }}</strong>
        </article>
        <article>
          <span>谈判风格</span><strong>{{ styleLabel(finalDiagnostic.negotiation_style) }}</strong>
        </article>
      </div>

      <div class="dimension-grid">
        <article v-for="dimension in finalDiagnostic.dimensions" :key="dimension.dimension_key">
          <div>
            <strong>{{ dimensionLabel(dimension.dimension_key) }}</strong
            ><b>{{ dimension.score }}</b>
          </div>
          <progress :value="dimension.score" max="100" />
          <p>{{ dimension.judgment }}</p>
          <blockquote v-if="dimension.evidence[0]">“{{ dimension.evidence[0].quote }}”</blockquote>
        </article>
      </div>

      <div class="next-zone">
        <div>
          <span>下一发展目标</span><strong>{{ finalDiagnostic.next_stretch_target }}</strong>
        </div>
        <div>
          <span>建议中介方式</span><strong>{{ finalDiagnostic.mediation_strategy }}</strong>
        </div>
      </div>

      <div v-if="finalDiagnostic.knowledge_mastery.length" class="mastery">
        <h3>知识点掌握</h3>
        <ul>
          <li v-for="item in finalDiagnostic.knowledge_mastery" :key="item.knowledge_point">
            <strong>{{ item.knowledge_point }}</strong
            ><span>{{ masteryLabel(item.status) }}</span>
          </li>
        </ul>
      </div>
    </template>

    <p v-else class="empty">训练结束后将形成综合发展诊断。</p>

    <details v-if="rounds.length" class="rounds">
      <summary>查看 {{ rounds.length }} 轮发展轨迹</summary>
      <ol>
        <li v-for="(round, index) in rounds" :key="round.round_evaluation_id">
          <div>
            <strong>第 {{ index + 1 }} 轮</strong>
            <span
              >挑战 {{ round.diagnostic.challenge_level }}/4 ·
              {{ supportLabel(round.diagnostic.support_level) }}</span
            >
          </div>
          <p>{{ round.diagnostic.adaptability_summary }}</p>
          <small>下一步：{{ round.diagnostic.next_stretch_target }}</small>
        </li>
      </ol>
    </details>
  </section>
</template>

<script setup lang="ts">
import type {
  DiagnosticDimensionKey,
  LearningDiagnostic,
  RoundLearningDiagnostic,
} from '../api/teacherApi'

defineProps<{ rounds: RoundLearningDiagnostic[]; finalDiagnostic: LearningDiagnostic | null }>()

const dimensionLabels: Record<DiagnosticDimensionKey, string> = {
  domain_knowledge: '贸易知识运用',
  language_control: '商务英语控制',
  negotiation_strategy: '谈判策略',
  adaptability: '临场应变',
  intercultural_pragmatics: '跨文化得体性',
  self_regulation: '自主调节',
}

function dimensionLabel(key: DiagnosticDimensionKey): string {
  return dimensionLabels[key]
}
function stageLabel(value: LearningDiagnostic['learner_stage']): string {
  return {
    foundation: '基础形成',
    developing: '持续发展',
    competent: '胜任',
    advanced: '高阶迁移',
  }[value]
}
function supportLabel(value: LearningDiagnostic['support_level']): string {
  return {
    explicit_model: '示范支持',
    guided_choice: '引导选择',
    implicit_prompt: '隐性提示',
    independent: '独立应对',
  }[value]
}
function styleLabel(value: LearningDiagnostic['negotiation_style']): string {
  return {
    cautious: '谨慎型',
    analytical: '分析型',
    assertive: '主张型',
    collaborative: '合作型',
    adaptive: '灵活型',
    unclear: '尚待观察',
  }[value]
}
function masteryLabel(value: LearningDiagnostic['knowledge_mastery'][number]['status']): string {
  return {
    not_observed: '尚未观察',
    emerging: '开始形成',
    developing: '发展中',
    secure: '稳定掌握',
  }[value]
}
</script>

<style scoped>
.diagnostic-panel {
  margin-top: var(--space-6);
  padding: var(--space-6);
  border: 1px solid #c9d9d1;
  border-radius: var(--radius-md);
  background: linear-gradient(145deg, #f7fbf9, #fff);
}
header,
.dimension-grid article > div,
.rounds li > div {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
}
.eyebrow,
h2,
h3 {
  margin: 0;
}
.eyebrow,
.framework {
  color: var(--color-primary);
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.08em;
}
.framework {
  padding: 0.35rem 0.65rem;
  border-radius: 999px;
  background: var(--color-primary-soft);
}
.intro,
.empty {
  color: var(--color-muted);
}
.summary-cards {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: var(--space-3);
  margin: var(--space-5) 0;
}
.summary-cards article {
  display: grid;
  gap: var(--space-1);
  padding: var(--space-4);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-surface);
}
.summary-cards span,
.next-zone span {
  color: var(--color-muted);
  font-size: 0.72rem;
}
.dimension-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-3);
}
.dimension-grid article {
  padding: var(--space-4);
  border-radius: var(--radius-sm);
  background: #fff;
}
progress {
  width: 100%;
  accent-color: var(--color-primary);
}
.dimension-grid p,
.dimension-grid blockquote,
.rounds p,
.rounds small {
  color: var(--color-muted);
  font-size: 0.78rem;
  line-height: 1.5;
}
.dimension-grid blockquote {
  margin: var(--space-2) 0 0;
  padding-left: var(--space-2);
  border-left: 2px solid #b8cdc3;
}
.next-zone {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-3);
  margin-top: var(--space-4);
}
.next-zone div {
  display: grid;
  gap: var(--space-1);
  padding: var(--space-4);
  border-left: 3px solid var(--color-primary);
  background: var(--color-primary-soft);
}
.mastery ul {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  padding: 0;
  list-style: none;
}
.mastery li {
  display: flex;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  border-radius: 999px;
  background: #edf4f0;
}
.mastery li span {
  color: var(--color-muted);
}
.rounds {
  margin-top: var(--space-5);
  border-top: 1px solid var(--color-border);
  padding-top: var(--space-4);
}
.rounds summary {
  color: var(--color-primary);
  font-weight: 750;
  cursor: pointer;
}
.rounds ol {
  display: grid;
  gap: var(--space-3);
  padding-left: 1.25rem;
}
.rounds li {
  padding: var(--space-3);
  background: #fff;
}
@media (max-width: 800px) {
  .summary-cards,
  .dimension-grid,
  .next-zone {
    grid-template-columns: 1fr;
  }
}
</style>
