/* [组件导读]
 * 业务名词：Attempt 是一次训练；仿真用逐段台词和角色演出呈现谈判，态势是根据原话证据计算的状态。
 * 用途：根据资源配置提供背景、头像和表情立绘地址。
 * 为什么与边界：资源寻址集中维护，让演出组件不直接拼接文件路径；图片加载失败的替代显示由组件处理。
 * 结构：先看导出的类型或函数，再沿其调用的 API、工具与返回状态理解数据流。
 * [/组件导读] */
import type { SimulationExpression } from '../types'

const root = '/simulation/david-lim-v1-draft'

export function useSimulationAssets() {
  function portrait(expression: SimulationExpression): string {
    return `${root}/characters/david-lim/${expression}.webp`
  }

  return {
    background: `${root}/scenes/meeting-room-day.webp`,
    avatar: `${root}/characters/david-lim/avatar.webp`,
    portrait,
  }
}
