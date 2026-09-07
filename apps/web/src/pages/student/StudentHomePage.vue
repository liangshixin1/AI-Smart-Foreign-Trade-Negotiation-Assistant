<template>
  <RoleWorkspaceLayout title="开启你的外贸谈判之旅">
    <p v-if="loading">正在加载课程路线…</p>
    <section v-else-if="error" role="alert">
      <p>{{ error }}</p>
      <button type="button" @click="reload">重试</button>
    </section>
    <template v-else-if="data">
      <CourseProgressHeader
        :course-title="data.course_title"
        :completed-units="data.completed_units"
        :total-units="data.total_units"
      />
      <ChapterRoadmap :chapters="data.chapters" />
      <StudentKnowledgeProgress
        :insights="knowledgeInsights"
        :loading="knowledgeLoading"
        :error="knowledgeError"
        @retry="reloadKnowledgeInsights"
      />
      <AttemptHistoryList />
    </template>
  </RoleWorkspaceLayout>
</template>

<script setup lang="ts">
import RoleWorkspaceLayout from '@/app/layouts/RoleWorkspaceLayout.vue'
import ChapterRoadmap from '@/features/curriculum/components/ChapterRoadmap.vue'
import CourseProgressHeader from '@/features/curriculum/components/CourseProgressHeader.vue'
import { useCourseMap } from '@/features/curriculum/composables/useCourseMap'
import StudentKnowledgeProgress from '@/features/knowledge-graph/components/StudentKnowledgeProgress.vue'
import { useStudentKnowledgeInsights } from '@/features/knowledge-graph/composables/useStudentKnowledgeInsights'
import AttemptHistoryList from '@/features/training/components/AttemptHistoryList.vue'

const { data, loading, error, reload } = useCourseMap()
const {
  insights: knowledgeInsights,
  loading: knowledgeLoading,
  error: knowledgeError,
  reload: reloadKnowledgeInsights,
} = useStudentKnowledgeInsights()
</script>
