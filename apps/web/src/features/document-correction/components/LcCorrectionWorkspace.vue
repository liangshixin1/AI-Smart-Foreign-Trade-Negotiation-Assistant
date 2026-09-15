<!-- [组件导读]
业务名词：信用证是银行按约定单据付款的承诺；MT700 是本项目的信用证报文样式；批注是学生提出的改证意见。
用途：信用证审改总工作台，组织合同简报、原证、审改单、学习支持和结果对照。
逻辑：useDocumentCorrection 管理草稿、保存和版本冲突；本组件维护标签页与选中字段，再把操作交给该状态模块或后端接口。教师查看能力由 teacher 参数传入。
结构：template 描述页面结构；script setup 声明输入、状态和事件；style 定义外观。
阅读线索：子组件 CorrectionEditor、Mt700ReviewCopy、ContractBriefPanel、CorrectionResultCompare；状态入口 useDocumentCorrection、useAuthStore、useRouter。
为什么：原证、学生意见和评分分开，才能保留证据与旧训练回放；保存冲突交给专用状态模块对账。
[/组件导读] -->
<template>
  <main class="lc-workspace">
    <header class="toolbar">
      <div>
        <RouterLink to="/student">返回课程</RouterLink>
        <h1>信用证审改模式</h1>
        <p>标记不符点，形成改证申请草案</p>
      </div>
      <div class="actions">
        <span role="status" aria-live="polite">{{ state }}</span
        ><button type="button" @click="tab = '学习支持'">学习支持</button
        ><button v-if="writable" type="button" :disabled="busy" @click="preview = true">
          预览改证申请
        </button>
      </div>
    </header>
    <p v-if="error" role="alert" class="notice">
      {{ error }} <button type="button" @click="reconcile">重新读取并对账</button>
    </p>
    <section v-if="state === '版本冲突'" class="notice" role="alert">
      <h2>版本冲突</h2>
      <p>本地草稿与服务器记录可能不同，请先比较。</p>
      <details>
        <summary>查看服务器版本</summary>
        <pre>{{ display(session?.annotations) }}</pre>
      </details>
      <details>
        <summary>查看当前草稿</summary>
        <pre>{{ display(Object.values(drafts)) }}</pre>
      </details>
      <button type="button" @click="resolve(true)">保留当前草稿并重新保存</button
      ><button type="button" @click="resolve(false)">采用服务器版本</button>
    </section>
    <p v-if="!session">正在恢复信用证…</p>
    <template v-else>
      <nav class="tabs" aria-label="审证工作区">
        <button
          v-for="name in tabs"
          :key="name"
          type="button"
          :aria-pressed="tab === name"
          @click="tab = name"
        >
          {{ name }}
        </button>
      </nav>
      <div class="progress">
        已标注 {{ Object.keys(drafts).length }} 项 / 本证含8处不符点
        <span v-if="session.read_only">· 只读回放</span>
      </div>
      <div class="columns" :class="{ supporting: tab === '学习支持' }">
        <aside class="brief" :class="{ mobileHidden: tab !== '简报' }">
          <ContractBriefPanel :facts="session.briefing.fact_groups" />
        </aside>
        <section
          class="paper"
          :class="{ mobileHidden: tab !== '信用证' }"
          aria-label="信用证审核副本"
        >
          <Mt700ReviewCopy
            :document="session.document"
            :marker="marker"
            :classes="markClass"
            @select="focusTarget"
          />
        </section>
        <aside class="review" :class="{ mobileHidden: tab !== '审改单' }">
          <h2>审改单</h2>
          <p v-if="!Object.keys(drafts).length">选择信用证字段或条款，标记疑点后填写改证意见。</p>
          <ol>
            <li v-for="(a, targetRef) in drafts" :key="targetRef">
              <button type="button" @click="focusTarget(String(targetRef))">
                {{ targetMap[String(targetRef)]?.tag }} ·
                {{ a.issue_category && a.evidence_ref ? '拟改内容已填写' : '待填写' }}
              </button>
            </li>
          </ol>
          <div
            v-if="selected && drafts[selected.ref]"
            class="editor-shell"
            role="region"
            aria-label="字段改证抽屉"
          >
            <CorrectionEditor
              :key="selected.ref"
              :target="selected"
              :annotation="drafts[selected.ref]!"
              :facts="session.briefing.fact_groups"
              :disabled="!writable"
              @edit="edit"
              @save="save"
              @remove="remove(selected.ref)"
              @close="selectedRef = ''"
            />
          </div>
        </aside>
        <aside v-if="tab === '学习支持'" class="support">
          <h2>学习支持</h2>
          <p>先主体，再金额，再装运，再单据，最后核对期限关系。</p>
          <p>当前字段：{{ selected?.tag ?? '尚未选择' }}</p>
          <dl>
            <dt>32B</dt>
            <dd>信用证币种与金额</dd>
            <dt>43P / 43T</dt>
            <dd>分批装运 / 转船，是两个不同条件</dd>
            <dt>44C</dt>
            <dd>最迟装运日</dd>
            <dt>31D / 48</dt>
            <dd>有效期与交单期，须和装运日共同核对</dd>
            <dt>46A</dt>
            <dd>要求提交的单据</dd>
          </dl>
          <button v-for="level in [1, 2, 3]" :key="level" type="button" @click="hint(level)">
            {{ level }}级线索
          </button>
          <p role="status">{{ hintText }}</p>
          <RouterLink to="/student/knowledge-graph">查看已发布知识图谱</RouterLink>
        </aside>
      </div>
      <footer class="bottom">
        <p>
          定位30% · 修改50% ·
          依据20%。误报每项扣3分，错误修改正确重大字段额外扣5分，合计最多扣15分。
        </p>
        <button v-if="writable" type="button" :disabled="busy" @click="check">
          检查填写完整性
        </button>
        <p role="status">{{ checkMessage }}</p>
      </footer>
      <CorrectionResultCompare v-if="session.result" :result="session.result" />
      <section v-if="session.result" class="bottom">
        <p>{{ session.feedback.message ?? session.feedback.summary }}</p>
        <button type="button" @click="feedback">生成个性化讲评</button
        ><button v-if="!teacher" type="button" @click="retry">重新练习</button>
        <details>
          <summary>版本与提交证据</summary>
          <pre>{{ display(session.profile) }}\n{{ display(session.hashes) }}</pre>
        </details>
      </section>
    </template>
    <div
      v-if="preview && session"
      class="overlay"
      role="dialog"
      aria-modal="true"
      aria-label="信用证修改申请草案"
    >
      <section class="preview">
        <h2>信用证修改申请草案</h2>
        <p>
          原证不会被直接改写，将提交改证意见。80分及以上且无重大遗漏、未错误修改正确重大字段、全部已提交项结构完整，才判通过。
        </p>
        <article v-for="a in drafts" :key="a.target_ref">
          <h3>{{ targetMap[a.target_ref]?.tag }} · {{ targetMap[a.target_ref]?.label }}</h3>
          <p>依据：{{ factLabel(a.evidence_ref) }}</p>
          <pre>{{ display(a.proposed_value) }}</pre>
        </article>
        <footer>
          <button type="button" @click="preview = false">返回修改</button
          ><button
            type="button"
            :disabled="busy || !writable || state === '版本冲突'"
            @click="confirmSubmit"
          >
            提交审证结果
          </button>
        </footer>
      </section>
    </div>
  </main>
</template>
<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/features/auth/stores/auth'
import { retryAttempt } from '@/features/training/api/trainingApi'
import { request } from '@/shared/api/http'
import { useDocumentCorrection } from '../composables/useDocumentCorrection'
import { display, factLabel } from '../labels'
import type { Target } from '../types'
import CorrectionEditor from './CorrectionEditor.vue'
import Mt700ReviewCopy from './Mt700ReviewCopy.vue'
import ContractBriefPanel from './ContractBriefPanel.vue'
import CorrectionResultCompare from './CorrectionResultCompare.vue'
const props = defineProps<{ attemptId: string; teacher?: boolean }>()
const {
  session,
  drafts,
  state,
  error,
  busy,
  writable,
  mark,
  edit,
  save,
  remove,
  resolve,
  reconcile,
  submit,
  api,
} = useDocumentCorrection(props.attemptId, props.teacher)
const tabs = ['简报', '信用证', '审改单', '学习支持']
const tab = ref('信用证'),
  selectedRef = ref(''),
  preview = ref(false),
  checkMessage = ref(''),
  hintText = ref('')
const auth = useAuthStore(),
  router = useRouter()
const targetMap = computed(() => {
  const map: Record<string, Target> = {}
  for (const section of session.value?.document.sections ?? [])
    for (const field of section.fields) {
      if (field.items.length)
        for (const item of field.items)
          map[item.item_id] = {
            ref: item.item_id,
            tag: field.tag,
            label: item.text,
            value_type: item.value_type,
            value: item.value,
            inputs: item.inputs,
          }
      else
        map[field.field_id] = {
          ref: field.field_id,
          tag: field.tag,
          label: field.label,
          value_type: field.value_type,
          value: field.value,
          inputs: field.inputs,
        }
    }
  return map
})
const selected = computed(() => targetMap.value[selectedRef.value])
// [导读] 记录当前字段，必要时建立批注草稿，然后切换到审改单供编辑。
function focusTarget(ref: string) {
  selectedRef.value = ref
  const target = targetMap.value[ref]
  if (target) mark(target)
  tab.value = '审改单'
}
// [导读] 根据字段是否已有草稿、草稿是否完整以及只读状态，生成标记按钮文案。
function marker(ref: string) {
  const index = Object.keys(drafts.value).indexOf(ref)
  return index < 0
    ? session.value?.read_only
      ? '查看字段'
      : '标记疑点'
    : `${String(index + 1)} · 已标记${dirtyLabel(ref)}`
}
// [导读] 这里只检查问题类型与依据是否填写，不判断改证答案是否正确。
function dirtyLabel(ref: string) {
  const a = drafts.value[ref]
  return a?.issue_category && a.evidence_ref ? '' : ' · 待填写'
}
// [导读] 将选中、已标记和评分结果中的漏找状态转换成模板使用的 CSS 类。
function markClass(ref: string) {
  const result = session.value?.result?.issue_results.find((i) => i.target_ref === ref)
  return {
    selected: selectedRef.value === ref,
    marked: !!drafts.value[ref],
    missed: result && !result.located,
  }
}
// [导读] 先保存再做结构检查；返回的格式完整提示不代表答案正确。
async function check() {
  if (!(await save())) return
  const response = await api().check()
  checkMessage.value = Object.keys(response.errors).length
    ? Object.values(response.errors).flat().join('；')
    : '已标记项目格式完整；此检查不判断答案对错。'
}
// [导读] 提交成功后关闭预览，提交过程及成绩读取由状态模块完成。
async function confirmSubmit() {
  if (await submit()) preview.value = false
}
// [导读] 请求个性化讲评后重新对账；讲评失败只设置提示，确定性成绩仍由原评分结果提供。
async function feedback() {
  try {
    await api().feedback()
    await reconcile()
  } catch {
    error.value = '个性化讲评暂不可用，确定性成绩不受影响。'
  }
}
// [导读] 用新的请求编号创建重练记录，跳转并重载页面以使用新训练上下文。
async function retry() {
  if (!auth.accessToken) return
  try {
    const attempt = await retryAttempt(
      auth.accessToken,
      props.attemptId,
      globalThis.crypto.randomUUID(),
    )
    await router.push(`/student/attempts/${attempt.id}`)
    globalThis.location.reload()
  } catch {
    error.value = '重练暂不可用，请重试。'
  }
}
// [导读] 按当前字段和提示层级请求学习支持；失败时显示可继续核对的备用说明。
async function hint(level: number) {
  try {
    const result = await request<{ text: string }>(
      `/api/v1/attempts/${props.attemptId}/document-correction/hints`,
      {
        method: 'POST',
        body: JSON.stringify({
          target_ref: selectedRef.value || 'overview',
          level,
          event_type: 'revealed',
        }),
      },
      auth.accessToken ?? '',
    )
    hintText.value = result.text
  } catch {
    hintText.value =
      '支持暂不可用。可按主体、金额、装运、单据、期限的顺序核对，不影响改证意见保存。'
  }
}
</script>
<style scoped>
.lc-workspace {
  min-height: 100dvh;
  background: #f3f5f0;
  color: #263d34;
  padding: 20px;
  overflow-wrap: anywhere;
}
.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 20px;
  margin-bottom: 16px;
}
h1 {
  font-size: 1.45rem;
  margin: 8px 0;
}
h2 {
  font-size: 1.15rem;
}
h3 {
  font-size: 0.9rem;
}
p {
  line-height: 1.65;
}
button,
a {
  color: #285b46;
}
button {
  cursor: pointer;
  padding: 10px 13px;
  border: 1px solid #b5cabc;
  border-radius: 6px;
  background: #fff;
  font: inherit;
}
button:disabled {
  opacity: 0.45;
  cursor: default;
}
button:focus-visible {
  outline: 3px solid #338761;
  outline-offset: 2px;
}
.actions,
.tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
}
.tabs {
  margin-bottom: 12px;
}
@media (min-width: 1051px) {
  .tabs {
    display: none;
  }
  .brief,
  .review {
    position: sticky;
    top: 16px;
    max-height: calc(100dvh - 32px);
    overflow: auto;
  }
}
.tabs [aria-pressed='true'] {
  background: #285b46;
  color: white;
}
.progress {
  font-size: 0.86rem;
  margin-bottom: 16px;
}
.columns {
  display: grid;
  grid-template-columns: minmax(190px, 0.7fr) minmax(460px, 2.4fr) minmax(230px, 0.8fr);
  gap: 18px;
  align-items: start;
}
.columns > * {
  min-width: 0;
}
.brief,
.review,
.support {
  background: #fff;
  border: 1px solid #dbe1d8;
  border-radius: 8px;
  padding: 18px;
}
.brief dt {
  font-size: 0.8rem;
  color: #687b6e;
  margin-top: 15px;
}
.brief dd {
  margin: 5px 0 0;
  white-space: pre-wrap;
  font-size: 0.88rem;
}
.paper {
  min-width: 0;
}
.review ol {
  padding-left: 20px;
  display: grid;
  gap: 8px;
}
.review li button {
  text-align: left;
  font-size: 0.8rem;
}
.support {
  grid-column: 1 / -1;
}
.bottom {
  margin: 18px 0;
  background: #eaf0e6;
  padding: 15px;
  border-radius: 8px;
  font-size: 0.85rem;
}
.notice {
  padding: 16px;
  background: #fff5df;
  border: 1px solid #d8be84;
}
pre {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  font: inherit;
}
.overlay {
  position: fixed;
  inset: 0;
  z-index: 60;
  display: grid;
  place-items: center;
  background: #132a2380;
  padding: 16px;
}
.preview {
  background: white;
  width: min(800px, 100%);
  max-height: 90dvh;
  overflow: auto;
  padding: 24px;
  box-sizing: border-box;
}
.preview footer {
  position: sticky;
  bottom: 0;
  background: white;
  padding: 12px;
  display: flex;
  gap: 12px;
}
@media (max-width: 1050px) {
  .columns {
    grid-template-columns: 1fr;
  }
  .mobileHidden {
    display: none;
  }
  .lc-workspace {
    padding: 12px;
  }
  .toolbar {
    align-items: flex-start;
    flex-direction: column;
  }

  .editor-shell {
    position: fixed;
    inset: 5dvh 0 0;
    z-index: 40;
    background: white;
    overflow: auto;
    padding: 20px;
    box-sizing: border-box;
    padding-bottom: env(safe-area-inset-bottom, 20px);
  }
  .review {
    min-height: 250px;
  }
  .columns.supporting .support {
    grid-column: auto;
  }
  .preview {
    padding: 16px;
  }
}
@media (min-width: 1051px) {
  .columns.supporting {
    grid-template-columns: minmax(190px, 0.7fr) minmax(460px, 2.4fr) minmax(230px, 0.8fr);
  }
}
</style>
