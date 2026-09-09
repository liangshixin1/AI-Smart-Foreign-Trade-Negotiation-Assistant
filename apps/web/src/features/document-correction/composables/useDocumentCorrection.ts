import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useAuthStore } from '@/features/auth/stores/auth'
import { ApiError } from '@/shared/api/http'
import { documentApi } from '../api/documentCorrectionApi'
import type { Annotation, CorrectionSession, Target } from '../types'

interface Pending {
  annotation: Annotation
  revision: number
  operation: string
  remove: boolean
}
export function useDocumentCorrection(id: string, teacher = false) {
  const auth = useAuthStore()
  const api = () => documentApi(auth.accessToken ?? '', id, teacher)
  const session = ref<CorrectionSession | null>(null)
  const drafts = ref<Record<string, Annotation>>({})
  const pending = ref<Pending | null>(null)
  const state = ref('正在载入')
  const error = ref('')
  const dirty = ref<string[]>([])
  const busy = ref(false)
  const ready = ref(false)
  const key = `lc-draft:${auth.user?.id ?? 'student'}:${id}`
  let timer: ReturnType<typeof setTimeout> | undefined
  const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T
  const writable = computed(() => ready.value && session.value && !session.value.read_only)
  function persist() {
    if (teacher) return
    try {
      localStorage.setItem(
        key,
        JSON.stringify({ drafts: drafts.value, dirty: dirty.value, pending: pending.value }),
      )
    } catch {
      error.value = '浏览器无法保留本地草稿，请保持页面打开并完成保存。'
    }
  }
  async function reload() {
    error.value = ''
    try {
      const latest = await api().get()
      session.value = latest
      for (const a of latest.annotations)
        if (!dirty.value.includes(a.target_ref)) drafts.value[a.target_ref] = clone(a)
      if (latest.read_only) {
        drafts.value = Object.fromEntries(latest.annotations.map((a) => [a.target_ref, clone(a)]))
        dirty.value = []
        pending.value = null
        persist()
      }
      state.value = pending.value ? '保存状态未知' : dirty.value.length ? '待保存' : '已保存'
      ready.value = true
    } catch (e) {
      error.value = e instanceof ApiError ? e.message : '单证暂无法载入，请检查连接后重试。'
    }
  }
  function edit(a: Annotation) {
    drafts.value[a.target_ref] = clone(a)
    if (!dirty.value.includes(a.target_ref)) dirty.value.push(a.target_ref)
    state.value = '待保存'
    persist()
    clearTimeout(timer)
    timer = setTimeout(() => {
      void save()
    }, 650)
  }
  function mark(target: Target) {
    if (!writable.value) return
    if (!drafts.value[target.ref])
      edit({
        target_ref: target.ref,
        issue_category: '',
        evidence_ref: '',
        proposed_value: clone(target.value),
        optional_note: '',
      })
  }
  async function save(): Promise<boolean> {
    if (busy.value || !session.value || !writable.value || state.value === '版本冲突') return false
    busy.value = true
    try {
      while (pending.value || dirty.value.length) {
        if (!pending.value) {
          const target = dirty.value[0]
          if (!target || !drafts.value[target]) break
          pending.value = {
            annotation: clone(drafts.value[target]),
            revision: session.value.revision,
            operation: crypto.randomUUID(),
            remove: false,
          }
          persist()
        }
        const op = clone(pending.value)
        state.value = '正在保存'
        const response = await api().save(op.annotation, op.revision, op.operation, op.remove)
        session.value.revision = response.revision
        session.value.annotations = response.annotations
        if (
          op.remove ||
          JSON.stringify(drafts.value[op.annotation.target_ref]) === JSON.stringify(op.annotation)
        ) {
          dirty.value = dirty.value.filter((r) => r !== op.annotation.target_ref)
          if (op.remove)
            drafts.value = Object.fromEntries(
              Object.entries(drafts.value).filter(([key]) => key !== op.annotation.target_ref),
            )
        }
        pending.value = null
        persist()
      }
      state.value = '已保存'
      return true
    } catch (e) {
      state.value = e instanceof ApiError && e.status === 409 ? '版本冲突' : '保存状态未知'
      error.value =
        e instanceof ApiError ? e.message : '保存状态未知：本地草稿已保留，请恢复连接后对账。'
      persist()
      return false
    } finally {
      busy.value = false
    }
  }
  async function reconcile() {
    await reload()
    if (pending.value || dirty.value.length) await save()
  }
  async function resolve(keepLocal: boolean) {
    await reload()
    if (!session.value) return
    pending.value = null
    if (!keepLocal) {
      drafts.value = Object.fromEntries(
        session.value.annotations.map((a) => [a.target_ref, clone(a)]),
      )
      dirty.value = []
    }
    state.value = '待保存'
    persist()
    await save()
  }
  async function remove(ref: string) {
    if (!(await save()) || !session.value || !drafts.value[ref]) return
    pending.value = {
      annotation: clone(drafts.value[ref]),
      revision: session.value.revision,
      operation: crypto.randomUUID(),
      remove: true,
    }
    persist()
    await save()
  }
  async function submit(): Promise<boolean> {
    if (!(await save()) || !session.value) return false
    busy.value = true
    try {
      await api().submit(session.value.revision, `lc-submit-${id}`)
      await reload()
      return true
    } catch (e) {
      error.value = e instanceof ApiError ? e.message : '提交状态未知，请重新读取结果后再试。'
      return false
    } finally {
      busy.value = false
    }
  }
  function onOnline() {
    void reconcile()
  }
  function beforeUnload(event: BeforeUnloadEvent) {
    persist()
    if (dirty.value.length || pending.value) {
      event.preventDefault()
    }
  }
  onMounted(async () => {
    if (!teacher) {
      try {
        const saved = JSON.parse(localStorage.getItem(key) ?? 'null') as {
          drafts: Record<string, Annotation>
          dirty: string[]
          pending: Pending | null
        } | null
        if (saved) {
          drafts.value = saved.drafts
          dirty.value = saved.dirty
          pending.value = saved.pending
        }
      } catch {
        error.value = '本地草稿无法读取，请核对服务器版本。'
      }
    }
    await reload()
    if (pending.value || dirty.value.length) await save()
    window.addEventListener('online', onOnline)
    window.addEventListener('beforeunload', beforeUnload)
  })
  onBeforeUnmount(() => {
    persist()
    clearTimeout(timer)
    window.removeEventListener('online', onOnline)
    window.removeEventListener('beforeunload', beforeUnload)
  })
  return {
    session,
    drafts,
    state,
    error,
    busy,
    writable,
    dirty,
    reload,
    mark,
    edit,
    save,
    remove,
    resolve,
    reconcile,
    submit,
    api,
  }
}
