<!-- [组件导读]
业务名词：信用证是银行按约定单据付款的承诺；MT700 是本项目的信用证报文样式；批注是学生提出的改证意见。
用途：按 MT700 风格展示只读信用证样张，并允许选择字段查看或标记疑点。
逻辑：document 提供原证，marker/classes 由父组件决定标记文案和颜色；点击仅发出 select，不在此处改写原证。
结构：template 描述页面结构；script setup 声明输入、状态和事件；style 定义外观。
为什么：审核是在原证上定位问题、另提改证意见，直接改原证会丢掉评分和回放依据。
[/组件导读] -->
<template>
  <div class="document-paper">
    <header class="document-heading">
      <div class="document-kicker">DOCUMENTARY CREDIT · ADVICE COPY</div>
      <span class="sample">TRAINING SAMPLE / 训练样张</span>
      <h2>信用证通知 / 审核副本</h2>
      <p>DOCUMENTARY CREDIT ADVICE</p>
    </header>
    <div class="reference">
      <span>Credit No. / 信用证编号</span><strong>{{ document.document_number }}</strong>
    </div>
    <p class="disclaimer">教学用 MT700 风格通知副本 · 原证只读；拟改意见须另行办理改证。</p>
    <table v-for="section in document.sections" :key="section.section_id">
      <caption>
        {{
          section.title
        }}
      </caption>
      <colgroup>
        <col class="tag-col" />
        <col class="label-col" />
        <col />
      </colgroup>
      <thead>
        <tr>
          <th scope="col">Tag</th>
          <th scope="col">Field / 字段</th>
          <th scope="col">Details / 信用证内容</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="field in section.fields" :key="field.field_id">
          <th scope="row" class="tag">:{{ field.tag }}:</th>
          <td class="field-name">{{ field.label }}</td>
          <td class="details">
            <template v-if="field.items.length">
              <div
                v-for="(item, index) in field.items"
                :key="item.item_id"
                class="clause"
                :class="classes(item.item_id)"
              >
                <span class="clause-no">{{ index + 1 }}.</span>
                <p>{{ item.text }}</p>
                <button
                  type="button"
                  :aria-label="`${field.tag} 第${index + 1}条 ${marker(item.item_id)}`"
                  @click="$emit('select', item.item_id)"
                >
                  {{ marker(item.item_id) }}
                </button>
              </div>
            </template>
            <div v-else class="clause" :class="classes(field.field_id)">
              <p>{{ documentValue(field.value) }}</p>
              <button
                type="button"
                :aria-label="`${field.tag} ${marker(field.field_id)}`"
                @click="$emit('select', field.field_id)"
              >
                {{ marker(field.field_id) }}
              </button>
            </div>
          </td>
        </tr>
      </tbody>
    </table>
    <footer>END OF CREDIT ADVICE <span>训练样张 · 无银行签章或认证效力</span></footer>
  </div>
</template>
<script setup lang="ts">
import type { CorrectionSession, Value } from '../types'
defineProps<{
  document: CorrectionSession['document']
  marker: (ref: string) => string
  classes: (ref: string) => object
}>()
defineEmits<{ select: [string] }>()
// [导读] 把原证的空值、普通值及金额或期限对象转换成样张文本；只格式化，不改变原数据。
function documentValue(value: Value): string {
  if (value === null) return '—'
  if (typeof value !== 'object') return String(value)
  if ('currency' in value && 'amount' in value)
    return `${String(value.currency)} ${String(value.amount)}`
  if ('expiry_date' in value)
    return `EXPIRY: ${String(value.expiry_date)} AT ${String(value.expiry_place)}\nPRESENTATION: WITHIN ${String(value.period_days)} DAYS AFTER SHIPMENT`
  return Object.values(value).map(String).join('\n')
}
</script>
<style scoped>
.document-paper {
  background: #fff;
  color: #1c262b;
  padding: 30px;
  border: 1px solid #bec8c8;
  box-shadow: 0 6px 24px #243b3210;
}
.document-heading {
  position: relative;
  border-top: 4px solid #253d39;
  padding-top: 16px;
}
.document-kicker {
  font:
    10px/1.5 Arial,
    sans-serif;
  letter-spacing: 0.16em;
}
.sample {
  display: inline-block;
  margin-top: 12px;
  font-size: 10px;
  border: 1px solid #899995;
  padding: 4px 8px;
}
h2 {
  margin: 18px 0 6px;
  font-size: 23px;
  letter-spacing: 0.08em;
}
.document-heading p {
  margin: 0 0 22px;
  font:
    bold 16px/1.4 Georgia,
    serif;
  letter-spacing: 0.035em;
}
.reference {
  border: 1px solid #586b67;
  display: flex;
  flex-wrap: wrap;
  gap: 8px 24px;
  padding: 10px 12px;
  font: 12px/1.5 monospace;
}
.reference span {
  color: #596966;
  font: 11px/1.5 sans-serif;
}
.disclaimer {
  font-size: 11px;
  line-height: 1.6;
  color: #65716e;
  margin: 12px 0;
}
table {
  border-collapse: collapse;
  table-layout: fixed;
  width: 100%;
  border: 1px solid #687b75;
}
caption {
  text-align: left;
  background: #eaf0ed;
  border: 1px solid #687b75;
  border-bottom: 0;
  padding: 8px 10px;
  font-size: 11px;
  letter-spacing: 0.04em;
}
.tag-col {
  width: 57px;
}
.label-col {
  width: 25%;
}
th,
td {
  border: 1px solid #aab8b3;
  vertical-align: top;
}
thead th {
  background: #f3f5f3;
  text-align: left;
  padding: 7px 9px;
  font: 10px/1.5 sans-serif;
  color: #5c6c66;
}
.tag {
  padding: 12px 7px;
  font: bold 12px/1.6 monospace;
}
.field-name {
  padding: 12px 10px;
  font:
    11px/1.65 Arial,
    sans-serif;
}
.details {
  padding: 0;
}
.clause {
  padding: 10px 12px;
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 5px 8px;
  border-left: 3px solid transparent;
}
.clause + .clause {
  border-top: 1px solid #d4dcd8;
}
.clause p {
  flex: 1 1 160px;
  margin: 0;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  font:
    12px/1.7 'Courier New',
    monospace;
}
.clause-no {
  font: 12px/1.7 monospace;
}
button {
  font: 10px/1.5 sans-serif;
  padding: 3px 6px;
  color: #46665a;
  background: white;
  border: 1px solid #c8d5ce;
  border-radius: 3px;
  cursor: pointer;
}
button:hover,
button:focus-visible {
  outline: 2px solid #436b5c;
  outline-offset: 2px;
}
.marked {
  border-left-color: #b77c27;
  background: #fffaf0;
}
.selected {
  box-shadow: inset 0 0 0 1px #2f6753;
}
.missed {
  border-left-color: #b84338;
}
footer {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  padding-top: 16px;
  color: #77837e;
  font: 9px/1.6 sans-serif;
  letter-spacing: 0.07em;
}
@media (max-width: 600px) {
  .document-paper {
    padding: 16px 10px;
  }
  h2 {
    font-size: 19px;
  }
  .tag-col {
    width: 44px;
  }
  .label-col {
    width: 25%;
  }
  .tag,
  .field-name {
    padding: 8px 4px;
    font-size: 10px;
  }
  .clause {
    padding: 8px 6px;
  }
  .clause p {
    font-size: 11px;
  }
  footer {
    flex-direction: column;
  }
}
</style>
