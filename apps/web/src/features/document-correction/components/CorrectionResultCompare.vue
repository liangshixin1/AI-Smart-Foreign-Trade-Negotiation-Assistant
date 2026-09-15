<!-- [组件导读]
业务名词：信用证是银行按约定单据付款的承诺；MT700 是本项目的信用证报文样式；批注是学生提出的改证意见。
用途：展示信用证审改成绩，以及原证、学生意见和标准意见的对照。
逻辑：只读取传入的 result 并格式化各项结果；评分和是否通过均来自后端结果。
结构：template 描述页面结构；script setup 声明输入、状态和事件；style 定义外观。
为什么：把原证、学生意见和标准并排，便于从字段证据理解扣分；前端不自行重算通关。
[/组件导读] -->
<template>
  <section class="results" aria-label="审证结果对照">
    <h2>{{ result.score }}分 · {{ result.passed ? '通过' : '未通过' }}</h2>
    <p>{{ result.summary }}</p>
    <p>
      得分 {{ result.gross_score }} − 误报扣分 {{ result.penalty }} =
      {{ result.score }}。成绩由确定性规则产生。
    </p>
    <article v-for="issue in result.issue_results" :key="issue.target_ref">
      <h3>
        {{ issue.target_ref }} ·
        {{
          !issue.located
            ? '✕ 未识别'
            : issue.corrected
              ? '✓ 识别正确、修改正确'
              : '△ 识别正确、修改有误'
        }}
      </h3>
      <dl>
        <dt>原证</dt>
        <dd>{{ display(issue.original_value) }}</dd>
        <dt>学生改证意见</dt>
        <dd>{{ display(issue.student_value) }}</dd>
        <dt>标准改证意见</dt>
        <dd>{{ display(issue.standard_value) }}</dd>
      </dl>
      <p>
        依据：{{ factLabel(issue.source_fact_ref) }} ·
        {{ issue.evidence_correct ? '依据正确' : '依据待改进' }}
      </p>
      <p>
        定位 {{ issue.parts.location }} + 修改 {{ issue.parts.correction }} + 依据
        {{ issue.parts.evidence }} = {{ issue.score }} / {{ issue.weight }}
      </p>
    </article>
    <p v-for="item in result.false_positives" :key="item.target_ref">
      △ 误报 {{ item.target_ref }}：扣 {{ item.penalty }} 分（合计扣分上限15）
    </p>
  </section>
</template>
<script setup lang="ts">
import type { Result } from '../types'
import { display, factLabel } from '../labels'
defineProps<{ result: Result }>()
</script>
<style scoped>
.results {
  padding: 20px;
  border: 1px solid #bfcec5;
  border-radius: 10px;
  background: #fff;
}
article {
  padding: 16px 0;
  border-top: 1px solid #e2e7e2;
}
h3 {
  font-size: 1rem;
}
dl {
  display: grid;
  grid-template-columns: 100px minmax(0, 1fr);
  gap: 12px;
}
dd {
  margin: 0;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
</style>
