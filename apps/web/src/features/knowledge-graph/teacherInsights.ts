/* [组件导读]
 * 业务名词：图谱把业务阶段、商务现象、知识点和策略连成关系；Scaffold 是某次训练固定的学习支持库，overlay 是证据高亮层。
 * 用途：集中导出该使用场景的组件、组合函数与类型。
 * 为什么与边界：按场景组织公共入口，调用方不必了解所有内部路径；具体行为沿被导出文件阅读。
 * 结构：先看导出的类型或函数，再沿其调用的 API、工具与返回状态理解数据流。
 * [/组件导读] */
export { default as KnowledgeInsightPanel } from './components/KnowledgeInsightPanel.vue'
export { useKnowledgeInsights } from './composables/useKnowledgeInsights'
