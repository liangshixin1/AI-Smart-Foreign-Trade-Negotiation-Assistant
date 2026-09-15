/* [组件导读]
 * 业务名词：信用证是银行按约定单据付款的承诺；MT700 是本项目的信用证报文样式；批注是学生提出的改证意见。
 * 用途：封装本业务的后端接口路径、请求参数和响应类型。
 * 为什么与边界：请求集中便于保持前后端契约一致；调用成功与业务完成可能不同，需检查返回状态，失败由调用方展示或重试。
 * 结构：先看导出的类型或函数，再沿其调用的 API、工具与返回状态理解数据流。
 * [/组件导读] */
import { request } from '@/shared/api/http'
import type { Annotation, CorrectionSession } from '../types'
export function documentApi(token: string, id: string, teacher = false) {
  const base = `/api/v1/${teacher ? 'teacher/attempts' : 'attempts'}/${id}/document-correction`
  return {
    get: () => request<CorrectionSession>(base, {}, token),
    save: (a: Annotation, revision: number, operation: string, remove = false) => {
      const body = remove
        ? {}
        : {
            issue_category: a.issue_category,
            proposed_value: a.proposed_value,
            evidence_ref: a.evidence_ref,
            optional_note: a.optional_note,
          }
      return request<{ revision: number; annotations: Annotation[] }>(
        `${base}/annotations/${encodeURIComponent(a.target_ref)}`,
        {
          method: remove ? 'DELETE' : 'PUT',
          body: JSON.stringify({
            ...body,
            expected_revision: revision,
            client_operation_id: operation,
          }),
        },
        token,
      )
    },
    check: () =>
      request<{ errors: Record<string, string[]> }>(
        `${base}/check-completeness`,
        { method: 'POST' },
        token,
      ),
    submit: (revision: number, key: string) =>
      request(
        `/api/v1/attempts/${id}/submit`,
        {
          method: 'POST',
          headers: { 'Idempotency-Key': key },
          body: JSON.stringify({ expected_revision: revision }),
        },
        token,
      ),
    feedback: () => request(`${base}/feedback`, { method: 'POST' }, token),
  }
}
