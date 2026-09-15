<!-- [组件导读]
业务名词：信用证是银行按约定单据付款的承诺；MT700 是本项目的信用证报文样式；批注是学生提出的改证意见。
用途：把信用证审改所需的合同事实按成交主体、价款、装运、期限和单据分组呈现。
逻辑：先把 facts 数组转换为按 fact_id 查找的对象，再按固定字段组读取；显示名称和复杂值格式由 labels.ts 负责。
结构：template 描述页面结构；script setup 声明输入、状态和事件；style 定义外观。
为什么：把原证、批注和成绩分开，才能解释每项改证依据；可编辑状态仍需后端校验。
[/组件导读] -->
<template>
  <div class="contract-brief">
    <p class="eyebrow">CONTRACT REFERENCE</p>
    <h2>合同与场景简报</h2>
    <p class="intro">对照成交条款审核来证，提出改证意见。</p>
    <section v-for="group in groups" :key="group.title">
      <h3>{{ group.title }}</h3>
      <dl>
        <template v-for="id in group.ids" :key="id"
          ><dt>{{ factLabel(id) }}</dt>
          <dd>{{ display(facts[id]) }}</dd></template
        >
      </dl>
    </section>
  </div>
</template>
<script setup lang="ts">
import { computed } from 'vue'
import { display, factLabel } from '../labels'
const props = defineProps<{ facts: { fact_id: string; value: unknown }[] }>()
const facts = computed(() => Object.fromEntries(props.facts.map((f) => [f.fact_id, f.value])))
const groups = [
  { title: '01 / 成交主体', ids: ['contract_number', 'applicant.name', 'beneficiary.name'] },
  {
    title: '02 / 货物与价款',
    ids: [
      'goods.product',
      'goods.quantity',
      'goods.unit',
      'amount.unit_price',
      'amount.currency',
      'amount.total',
      'goods.incoterm',
      'goods.incoterm_place',
      'goods.incoterms_version',
      'payment.method',
    ],
  },
  {
    title: '03 / 装运安排',
    ids: [
      'shipment.partial_shipments',
      'shipment.transshipment',
      'shipment.transshipment_via',
      'shipment.transshipment_condition',
      'shipment.ports',
    ],
  },
  {
    title: '04 / 日期与期限',
    ids: [
      'document.issue_date',
      'shipment.receipt_date',
      'shipment.days_after_receipt',
      'shipment.latest_date',
      'presentation.period_days',
      'presentation.expiry_date',
      'presentation.expiry_place',
    ],
  },
  { title: '05 / 单据与服务', ids: ['documents_required', 'contract_only.added_services'] },
]
</script>
<style scoped>
.eyebrow {
  font-size: 10px;
  letter-spacing: 0.1em;
  color: #7a8982;
}
h2 {
  font-size: 16px;
  margin: 8px 0;
}
.intro {
  font-size: 12px;
  line-height: 1.7;
  color: #6b7b72;
}
section {
  border-top: 1px solid #dfe5df;
  margin-top: 18px;
  padding-top: 8px;
}
h3 {
  font-size: 11px;
  letter-spacing: 0.04em;
  color: #537060;
}
dl {
  margin: 0;
}
dt {
  font-size: 10px;
  color: #77857b;
  margin-top: 10px;
}
dd {
  margin: 3px 0 0;
  font-size: 12px;
  line-height: 1.6;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
</style>
