<template>
  <RoleWorkspaceLayout title="开启你的外贸谈判之旅">
    <p v-if="loading">正在加载课程路线…</p>
    <section v-else-if="error" role="alert">
      <p>{{ error }}</p>
      <button type="button" @click="reload">重试</button>
    </section>
    <template v-else-if="data">
      <nav class="knowledge-entry">
        <RouterLink to="/student/knowledge-graph">知识图谱与知识学习</RouterLink>
      </nav>
      <CourseProgressHeader
        :course-title="data.course_title"
        :completed-units="data.completed_units"
        :total-units="data.total_units"
      />
      <ChapterRoadmap :chapters="data.chapters" />
      <AttemptHistoryList />
    </template>
  </RoleWorkspaceLayout>
</template>

<script setup lang="ts">
import RoleWorkspaceLayout from '@/app/layouts/RoleWorkspaceLayout.vue'
import ChapterRoadmap from '@/features/curriculum/components/ChapterRoadmap.vue'
import CourseProgressHeader from '@/features/curriculum/components/CourseProgressHeader.vue'
import { useCourseMap } from '@/features/curriculum/composables/useCourseMap'
import AttemptHistoryList from '@/features/training/components/AttemptHistoryList.vue'

const { data, loading, error, reload } = useCourseMap()
</script>

<style scoped>
.knowledge-entry {
  display: flex;
  justify-content: flex-end;
  margin-bottom: var(--space-4);
}
.knowledge-entry a {
  padding: var(--space-2) var(--space-4);
  border: 1px solid var(--color-primary);
  border-radius: 999px;
  color: var(--color-primary);
  font-weight: 750;
  text-decoration: none;
}
</style>
