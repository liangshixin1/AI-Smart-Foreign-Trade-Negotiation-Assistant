/* [组件导读]
 * 业务名词：Attempt 是一次训练；仿真用逐段台词和角色演出呈现谈判，态势是根据原话证据计算的状态。
 * 用途：集中导出该使用场景的组件、组合函数与类型。
 * 为什么与边界：按场景组织公共入口，调用方不必了解所有内部路径；具体行为沿被导出文件阅读。
 * 结构：先看导出的类型或函数，再沿其调用的 API、工具与返回状态理解数据流。
 * [/组件导读] */
export { default as SimulationWorkspace } from './components/SimulationWorkspace.vue'
export { default as BriefingPlayer } from './components/BriefingPlayer.vue'
export { useSimulationSession } from './composables/useSimulationSession'
export type * from './types'
