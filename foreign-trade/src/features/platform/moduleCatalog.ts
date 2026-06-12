export interface PlatformModule {
  eyebrow: string
  title: string
  description: string
  capabilities: string[]
  accent: 'blue' | 'cyan' | 'gold'
}

/**
 * 模块目录是迁移边界的单一事实来源。
 * 后续接入真实页面时，可逐项替换链接和组件，无需改动首页布局。
 */
export const platformModules: PlatformModule[] = [
  {
    eyebrow: 'STUDENT EXPERIENCE',
    title: '谈判训练域',
    description: '场景、会话、实时评估与成长档案按学习流程聚合，避免跨模块共享临时状态。',
    capabilities: ['场景生成', '多轮谈判', '能力评估'],
    accent: 'blue',
  },
  {
    eyebrow: 'TEACHING OPERATIONS',
    title: '教学管理域',
    description: '课程、作业和学生分析形成独立教师工作台，并通过稳定 API 与训练域协作。',
    capabilities: ['课程编排', '任务发布', '学情分析'],
    accent: 'cyan',
  },
  {
    eyebrow: 'KNOWLEDGE INTELLIGENCE',
    title: '知识智能域',
    description: '图谱、教材导入、检索与词汇建议统一为知识服务，隔离 Neo4j 和模型实现细节。',
    capabilities: ['知识图谱', 'RAG 检索', '词汇网络'],
    accent: 'gold',
  },
]
