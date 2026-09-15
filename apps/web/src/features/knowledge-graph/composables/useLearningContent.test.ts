import { flushPromises, mount } from '@vue/test-utils'
import { defineComponent, ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { knowledgeGraphLearningApi as api } from '../api/knowledgeGraphLearningApi'
import { useStudentLearningContent, useTeacherLearningContent } from './useLearningContent'
import { useLearningActivity } from './useLearningActivity'
import type { LearningContent } from '../types'

vi.mock('@/features/auth/stores/auth', () => ({ useAuthStore: () => ({ accessToken: 'test' }) }))
vi.mock('../api/knowledgeGraphLearningApi', () => ({
  knowledgeGraphLearningApi: {
    studentContent: vi.fn(),
    teacherContent: vi.fn(),
    uploadTeacherAsset: vi.fn(),
    recordLearningActivity: vi.fn(),
  },
}))
const lesson = (id: string): LearningContent => ({
  graph_version: 'v3',
  node_id: id,
  node_type: 'Stage',
  title: id,
  summary: '',
  markdown_body: id,
  assets: [],
  status: 'published',
  updated_at: null,
})

const harness = (setup: () => void) =>
  defineComponent({
    setup() {
      setup()
      return () => null
    },
  })

describe('independent node learning', () => {
  beforeEach(() => vi.resetAllMocks())
  it('ignores a late previous-node response and records the current node', async () => {
    const node = ref('stage:S1')
    let resolveOld!: (value: LearningContent) => void
    vi.mocked(api.studentContent)
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveOld = resolve
          }),
      )
      .mockResolvedValueOnce(lesson('phenomenon:P1.01'))
    let state!: ReturnType<typeof useStudentLearningContent>
    let activity!: ReturnType<typeof useLearningActivity>
    const wrapper = mount(
      harness(() => {
        state = useStudentLearningContent(node)
        activity = useLearningActivity(node, 'map', null)
      }),
    )
    node.value = 'phenomenon:P1.01'
    await flushPromises()
    resolveOld(lesson('stage:S1'))
    await flushPromises()
    expect(state.content.value?.node_id).toBe('phenomenon:P1.01')
    await activity.record('completed')
    expect(api.recordLearningActivity).toHaveBeenCalledWith(
      'test',
      'phenomenon:P1.01',
      'completed',
      'map',
      null,
      expect.any(String),
    )
    node.value = 'stage:S2'
    expect(activity.completed.value).toBe(false)
    wrapper.unmount()
  })
  it('keeps unsaved lesson text when uploading a resource', async () => {
    vi.mocked(api.teacherContent).mockResolvedValue(lesson('stage:S1'))
    vi.mocked(api.uploadTeacherAsset).mockResolvedValue(lesson('stage:S1'))
    let state!: ReturnType<typeof useTeacherLearningContent>
    const wrapper = mount(
      harness(() => {
        state = useTeacherLearningContent('stage:S1')
      }),
    )
    await flushPromises()
    state.form.markdown_body = '尚未保存的阶段精讲'
    await state.uploadAsset('slides', new File(['data'], 'lesson.pptx'))
    expect(state.form.markdown_body).toBe('尚未保存的阶段精讲')
    wrapper.unmount()
  })
})
