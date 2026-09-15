<!-- [组件导读]
业务名词：信用证是银行按约定单据付款的承诺；MT700 是本项目的信用证报文样式；批注是学生提出的改证意见。
用途：编辑选中信用证字段的改证意见，包括问题类型、合同依据与拟改值。
逻辑：根据目标字段的数据类型选择输入控件；通过 edit 事件传出新对象，save/remove/close 交由外层工作台处理。
结构：template 描述页面结构；script setup 声明输入、状态和事件；style 定义外观。
为什么：把原证、批注和成绩分开，才能解释每项改证依据；可编辑状态仍需后端校验。
[/组件导读] -->
<template>
  <section aria-label="改证意见编辑器" class="editor">
    <header>
      <h3>{{ target.tag }} · 改证意见</h3>
      <button type="button" @click="$emit('close')">关闭编辑</button>
    </header>
    <p class="original">原文：{{ target.label }}<br />{{ display(target.value) }}</p>
    <fieldset :disabled="disabled">
      <label
        >问题类型<select
          :value="annotation.issue_category"
          @change="change('issue_category', val($event))"
        >
          <option value="">请选择</option>
          <option value="contract_mismatch">与合同或场景不符</option>
          <option value="unperformable">业务无法履行</option>
          <option value="ambiguous">表述含糊</option>
          <option value="other">其他</option>
        </select></label
      >
      <label
        >合同或场景依据<select
          :value="annotation.evidence_ref"
          @change="change('evidence_ref', val($event))"
        >
          <option value="">请选择依据</option>
          <option v-for="fact in facts" :key="fact.fact_id" :value="fact.fact_id">
            {{ factLabel(fact.fact_id) }}：{{ display(fact.value) }}
          </option>
        </select></label
      >
      <template v-if="objectValue">
        <template v-if="target.value_type === 'clause_list'">
          <label
            >条款处理<select :value="objectValue.action" @change="part('action', val($event))">
              <option value="retain">保留</option>
              <option value="delete">删除</option>
              <option value="replace">替换</option>
            </select></label
          >
          <template v-if="objectValue.action === 'replace'">
            <label
              >替换模板<select
                :value="objectValue.template"
                @change="part('template', val($event))"
              >
                <option value="">请选择模板</option>
                <option value="commercial_invoice">商业发票</option>
                <option value="packing_list">装箱单</option>
                <option value="bill_of_lading">海运提单</option>
                <option value="insurance">保险单据</option>
              </select></label
            >
            <label
              >必要参数<input
                :value="objectValue.parameter"
                @input="part('parameter', val($event))"
            /></label>
          </template>
        </template>
        <template v-else>
          <label v-for="key in target.inputs" :key="key"
            >{{ inputLabel(key) }}
            <select
              v-if="key === 'currency'"
              :value="objectValue[key]"
              @change="part(key, val($event))"
            >
              <option v-for="currency in ['USD', 'EUR', 'CNY', 'SGD']" :key="currency">
                {{ currency }}
              </option>
            </select>
            <select
              v-else-if="key === 'incoterm'"
              :value="objectValue[key]"
              @change="part(key, val($event))"
            >
              <option v-for="term in ['CIF', 'CFR', 'FOB', 'EXW']" :key="term">{{ term }}</option>
            </select>
            <input
              v-else
              :type="key.includes('date') ? 'date' : 'text'"
              :inputmode="
                ['amount', 'unit_price', 'quantity', 'period_days'].includes(key)
                  ? 'decimal'
                  : 'text'
              "
              :value="objectValue[key]"
              @input="part(key, val($event))"
            />
          </label>
          <p v-if="target.value_type === 'field_relation'">
            按实际装运日计算交单期，同时不能超过信用证有效期。请与 :44C: 共同核对。
          </p>
        </template>
      </template>
      <label v-else
        >拟修改为
        <select
          v-if="target.value_type === 'enum'"
          :value="annotation.proposed_value"
          @change="change('proposed_value', val($event))"
        >
          <option v-for="value in enumValues" :key="value">{{ value }}</option>
        </select>
        <input
          v-else
          :type="target.value_type === 'date' ? 'date' : 'text'"
          :value="annotation.proposed_value ?? ''"
          @input="change('proposed_value', val($event))"
        />
      </label>
      <label
        >补充说明（不计核心分）<textarea
          :value="annotation.optional_note"
          maxlength="2000"
          @input="change('optional_note', val($event))"
        />
      </label>
    </fieldset>
    <footer>
      <button type="button" :disabled="disabled" @click="$emit('save')">保存改证意见</button
      ><button type="button" :disabled="disabled" @click="$emit('remove')">撤销标记</button>
    </footer>
  </section>
</template>
<script setup lang="ts">
import { computed } from 'vue'
import type { Annotation, Target } from '../types'
import { display, factLabel, inputLabel } from '../labels'
const props = defineProps<{
  target: Target
  annotation: Annotation
  facts: { fact_id: string; value: unknown }[]
  disabled: boolean
}>()
const emit = defineEmits<{ edit: [Annotation]; save: []; remove: []; close: [] }>()
const objectValue = computed(() =>
  typeof props.annotation.proposed_value === 'object' ? props.annotation.proposed_value : null,
)
const enumValues = computed(() =>
  props.target.ref === 'mt700-40a'
    ? ['IRREVOCABLE', 'REVOCABLE']
    : ['ALLOWED', 'NOT ALLOWED', 'CONDITIONAL'],
)
// [导读] 从原生输入事件中读取字符串值，供各输入控件复用。
function val(event: Event) {
  return (event.target as HTMLInputElement).value
}
// [导读] 复制现有批注后替换指定字段，再发出 edit，避免直接修改父组件传入的对象。
function change(key: string, value: unknown) {
  emit('edit', { ...props.annotation, [key]: value })
}
// [导读] 编辑拟改值中的一个子字段，保留该复合值中其余已填写内容。
function part(key: string, value: string) {
  change('proposed_value', { ...objectValue.value, [key]: value })
}
</script>
<style scoped>
.editor {
  display: grid;
  gap: 16px;
  min-width: 0;
}
header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
h3 {
  margin: 0;
  font-size: 1rem;
}
.original {
  background: #f2f3ef;
  padding: 12px;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
fieldset {
  border: 0;
  padding: 0;
  margin: 0;
  display: grid;
  gap: 14px;
  min-width: 0;
}
label {
  display: grid;
  gap: 7px;
  font-size: 0.88rem;
}
input,
select,
textarea {
  min-width: 0;
  width: 100%;
  box-sizing: border-box;
  padding: 10px;
  border: 1px solid #c9d4ce;
  border-radius: 6px;
  font: inherit;
  background: white;
  color: #233b34;
}
textarea {
  min-height: 80px;
}
footer {
  position: sticky;
  bottom: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  background: #fff;
  padding: 12px 0;
}
button {
  padding: 10px;
  border: 1px solid #b6c9be;
  background: #eef5ef;
  border-radius: 6px;
  color: #234d3d;
  cursor: pointer;
}
button:disabled {
  opacity: 0.5;
}
</style>
