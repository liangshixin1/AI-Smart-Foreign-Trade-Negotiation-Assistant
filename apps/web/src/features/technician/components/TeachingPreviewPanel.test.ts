import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import TeachingPreviewPanel from '@/features/technician/components/TeachingPreviewPanel.vue'
import type { TeachingCasePreview } from '@/features/technician/types/knowledgeGraph'

function teachingCase(id: string, title: string): TeachingCasePreview {
  return {
    case_id: id,
    title,
    course_unit: '流程 2 · 报盘',
    training_mode: '谈判对话',
    task: '识别虚盘并请求实盘。',
    situations: [
      { situation_id: 'S1', signal: 'subject to final confirmation', recognition: '无约束力' },
    ],
    strategies: [{ situation_id: 'S1', name: '请求实盘', action: '请求完整条件与有效期。' }],
    resources: [{ type: '术语', title: '实盘与虚盘', timing: '训练前' }],
    scaffolds: [{ situation_id: 'S1', level: '1级', trigger: '未识别限定语' }],
    rubrics: [{ dimension: '承诺性质识别', weight: 100 }],
    outcomes: [{ result: '取得实盘', ideal: true }],
  }
}

describe('TeachingPreviewPanel', () => {
  it('先展示教学链并允许切换案例', async () => {
    const wrapper = mount(TeachingPreviewPanel, {
      props: {
        cases: [teachingCase('CASE-001', '应对虚盘'), teachingCase('CASE-002', '价格还盘')],
      },
    })
    expect(wrapper.text()).toContain('应对虚盘')
    expect(wrapper.text()).toContain('学生任务')
    expect(wrapper.text()).toContain('实盘与虚盘')

    await wrapper.findAll('nav button')[1]?.trigger('click')
    expect(wrapper.find('.case-detail').text()).toContain('价格还盘')
  })
})
