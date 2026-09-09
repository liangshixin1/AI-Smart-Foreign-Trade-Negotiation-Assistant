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
