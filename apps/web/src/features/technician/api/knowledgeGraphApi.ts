import { request } from '@/shared/api/http'
import type {
  GraphChangeSet,
  GraphPublication,
  KnowledgeImportJob,
  TeachingCasePreview,
  ValidationIssue,
} from '@/features/technician/types/knowledgeGraph'

const baseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000'

export const knowledgeGraphApi = {
  async downloadTemplate(token: string): Promise<Blob> {
    const response = await fetch(
      `${baseUrl}/api/v1/knowledge-graph/templates/teacher-case/latest`,
      { headers: { Authorization: `Bearer ${token}` } },
    )
    if (!response.ok) throw new Error('模板下载失败，请重试。')
    return response.blob()
  },
  upload: (token: string, file: File) =>
    request<KnowledgeImportJob>(
      '/api/v1/knowledge-graph/imports',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'X-File-Name': encodeURIComponent(file.name),
          'X-Template-Version': '3.0',
        },
        body: file,
      },
      token,
    ),
  issues: (token: string, jobId: string) =>
    request<ValidationIssue[]>(`/api/v1/knowledge-graph/imports/${jobId}/issues`, {}, token),
  changeSet: (token: string, jobId: string) =>
    request<GraphChangeSet>(`/api/v1/knowledge-graph/imports/${jobId}/change-set`, {}, token),
  preview: (token: string, jobId: string) =>
    request<TeachingCasePreview[]>(
      `/api/v1/knowledge-graph/imports/${jobId}/teaching-preview`,
      {},
      token,
    ),
  submitReview: (token: string, changeSetId: string) =>
    request<GraphChangeSet>(
      `/api/v1/knowledge-graph/change-sets/${changeSetId}/submit-review`,
      { method: 'POST' },
      token,
    ),
  decide: (token: string, changeSetId: string, decision: 'approve' | 'reject', reason?: string) =>
    request<GraphChangeSet>(
      `/api/v1/knowledge-graph/change-sets/${changeSetId}/decision`,
      { method: 'POST', body: JSON.stringify({ decision, reason }) },
      token,
    ),
  publish: (token: string, changeSetId: string) =>
    request<GraphPublication>(
      `/api/v1/knowledge-graph/change-sets/${changeSetId}/publish`,
      { method: 'POST' },
      token,
    ),
  active: (token: string) =>
    request<GraphPublication | null>('/api/v1/knowledge-graph/publications/active', {}, token),
  rollback: (token: string, publicationId: string) =>
    request<GraphPublication>(
      `/api/v1/knowledge-graph/publications/${publicationId}/rollback`,
      { method: 'POST' },
      token,
    ),
}
