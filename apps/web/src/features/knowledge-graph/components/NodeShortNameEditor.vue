<!-- [组件导读]
业务名词：图谱把业务阶段、商务现象、知识点和策略连成关系；Scaffold 是某次训练固定的学习支持库，overlay 是证据高亮层。
用途：供教师编辑节点显示短名或恢复默认名称。
逻辑：本地草稿校验长度和非法字符后，发出包含 display_revision 的保存事件；节点或版本变化会重置编辑状态，版本冲突由外层请求处理。
结构：template 描述页面结构；script setup 声明输入、状态和事件；style 定义外观。
为什么：名称是展示属性，保存应携带版本而不是盲目覆盖；失败时由父级显示原因。
[/组件导读] -->
<template>
  <section class="editor" aria-label="图谱显示名称维护">
    <div v-if="!editing" class="read-state">
      <span v-if="node.has_display_override" class="revised">教师已修订</span>
      <button type="button" class="edit-button" @click="startEditing">编辑图谱显示名称</button>
    </div>
    <form v-else @submit.prevent="save">
      <label for="node-short-name">
        图谱显示名称
        <span>{{ draft.trim().length }}/16</span>
      </label>
      <input
        id="node-short-name"
        v-model="draft"
        type="text"
        minlength="2"
        maxlength="16"
        autocomplete="off"
        :disabled="saving"
        @keydown.esc.prevent="cancel"
      />
      <p class="guidance">仅覆盖本版本的前端展示；专家中文名称、节点关系和训练逻辑不会改变。</p>
      <p v-if="validationError || (submitted && error)" class="error" role="alert">
        {{ validationError || error }}
      </p>
      <div class="preview">
        <span>图谱预览</span>
        <strong>{{ draft.trim() || '图谱显示名称' }}</strong>
      </div>
      <div class="actions">
        <button type="button" :disabled="saving" @click="cancel">取消</button>
        <button
          v-if="node.has_display_override"
          type="button"
          class="restore"
          :disabled="saving"
          @click="confirmingRestore = true"
        >
          恢复导入值
        </button>
        <button
          type="submit"
          class="primary"
          :disabled="saving || Boolean(validationError) || !hasChanges"
        >
          {{ saving ? '保存中…' : '保存显示名称' }}
        </button>
      </div>
      <div v-if="confirmingRestore" class="restore-confirm" role="alert">
        <p>恢复后将重新显示专家图谱中的中文名称。</p>
        <button type="button" :disabled="saving" @click="confirmingRestore = false">
          暂不恢复
        </button>
        <button type="button" class="danger" :disabled="saving" @click="restore">确认恢复</button>
      </div>
    </form>
  </section>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import type { KnowledgeGraphNode } from '../types'

const props = defineProps<{
  node: KnowledgeGraphNode
  saving: boolean
  error: string | null
}>()
const emit = defineEmits<{
  save: [shortNameZh: string, expectedRevision: number]
  restore: [expectedRevision: number]
}>()
const editing = ref(false)
const confirmingRestore = ref(false)
const submitted = ref(false)
const draft = ref(props.node.short_label)
const normalized = computed(() => draft.value.trim())
const hasChanges = computed(() => normalized.value !== props.node.short_label)
const validationError = computed(() => {
  if (normalized.value.length < 2 || normalized.value.length > 16) {
    return '请输入 2 至 16 个字符。'
  }
  if (/[<>\r\n]/.test(normalized.value)) return '不能包含换行或尖括号。'
  return ''
})

// [导读] 从当前短名初始化草稿，清除上次提交标记并打开编辑区。
function startEditing(): void {
  draft.value = props.node.short_label
  submitted.value = false
  editing.value = true
}
// [导读] 丢弃本次本地编辑，恢复传入的短名并关闭确认状态。
function cancel(): void {
  draft.value = props.node.short_label
  editing.value = false
  confirmingRestore.value = false
  submitted.value = false
}
// [导读] 校验通过且内容有变化才发送保存事件，同时附上当前显示版本。
function save(): void {
  if (validationError.value || !hasChanges.value) return
  submitted.value = true
  emit('save', normalized.value, props.node.display_revision ?? 0)
}
// [导读] 发出恢复默认名称的事件并附上版本，实际结果由外层更新的 node 返回。
function restore(): void {
  submitted.value = true
  emit('restore', props.node.display_revision ?? 0)
  confirmingRestore.value = false
}

watch(
  () => [props.node.id, props.node.short_label, props.node.display_revision] as const,
  () => {
    draft.value = props.node.short_label
    editing.value = false
    confirmingRestore.value = false
    submitted.value = false
  },
)
</script>

<style scoped>
.editor {
  margin-top: var(--space-3);
}
.read-state,
.actions,
.restore-confirm {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}
.read-state {
  justify-content: flex-start;
}
.revised {
  padding: 4px 8px;
  border-radius: 999px;
  color: var(--color-primary);
  background: var(--color-primary-soft);
  font-size: 0.7rem;
  font-weight: 700;
}
button {
  min-height: 34px;
  padding: 0 11px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-surface);
  cursor: pointer;
}
.edit-button {
  color: var(--color-primary);
}
form {
  padding: var(--space-4);
  border: 1px solid #bed9cc;
  border-radius: var(--radius-sm);
  background: #f4faf7;
}
label {
  display: flex;
  justify-content: space-between;
  font-size: 0.78rem;
  font-weight: 750;
}
label span,
.guidance {
  color: var(--color-muted);
  font-weight: 500;
}
input {
  width: 100%;
  min-height: 42px;
  margin-top: 6px;
  padding: 0 12px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-surface);
}
.guidance,
.error {
  margin: 7px 0 0;
  font-size: 0.72rem;
}
.error {
  color: var(--color-danger);
}
.preview {
  display: flex;
  align-items: center;
  gap: 9px;
  margin-top: var(--space-3);
  font-size: 0.72rem;
}
.preview span {
  color: var(--color-muted);
}
.preview strong {
  padding: 5px 9px;
  border-radius: 999px;
  background: var(--color-surface);
}
.actions {
  justify-content: flex-end;
  margin-top: var(--space-3);
}
.primary,
.danger {
  color: white;
  border-color: transparent;
  background: var(--color-primary);
}
.restore {
  margin-right: auto;
}
.restore-confirm {
  flex-wrap: wrap;
  margin-top: var(--space-3);
  padding-top: var(--space-3);
  border-top: 1px solid var(--color-border);
}
.restore-confirm p {
  width: 100%;
  margin: 0;
  font-size: 0.75rem;
}
.danger {
  background: var(--color-danger);
}
button:disabled,
input:disabled {
  cursor: not-allowed;
  opacity: 0.58;
}
</style>
