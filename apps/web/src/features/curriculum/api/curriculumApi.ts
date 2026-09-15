/* [组件导读]
 * 业务名词：课程由章节和小节组成；小节是训练入口，一次实际作答会形成独立的 Attempt（训练记录）。
 * 用途：封装本业务的后端接口路径、请求参数和响应类型。
 * 为什么与边界：请求集中便于保持前后端契约一致；调用成功与业务完成可能不同，需检查返回状态，失败由调用方展示或重试。
 * 结构：先看导出的类型或函数，再沿其调用的 API、工具与返回状态理解数据流。
 * [/组件导读] */
import type { CourseMap, UnitDetail } from '@/features/curriculum/types'
import { request } from '@/shared/api/http'

export const curriculumApi = {
  map(accessToken: string): Promise<CourseMap> {
    return request('/api/v1/courses/current/map', {}, accessToken)
  },
  unit(unitId: string, accessToken: string): Promise<UnitDetail> {
    return request(`/api/v1/units/${encodeURIComponent(unitId)}`, {}, accessToken)
  },
}
