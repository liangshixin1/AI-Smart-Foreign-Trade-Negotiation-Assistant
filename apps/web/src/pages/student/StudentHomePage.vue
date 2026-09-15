<!-- [组件导读]
业务名词：Attempt 是一次训练记录；学生负责练习，教师查看所属班级学情，技术人员维护平台运行配置。
用途：学生学习首页，组合课程进度、章节路线、知识概况与历史训练。
逻辑：课程和知识学情分别由组合函数加载，各自显示加载或失败状态；子组件负责展示及跳转入口。
结构：template 描述页面结构；script setup 声明依赖与逻辑，外观沿用共享样式。
阅读线索：子组件 RoleWorkspaceLayout、ChapterRoadmap、CourseProgressHeader、StudentKnowledgeProgress、AttemptHistoryList；状态入口 useCourseMap、useStudentKnowledgeInsights。
为什么：把页面组合与数据处理分开，方便沿调用关系定位问题；页面显示成功需以实际请求结果为准。
[/组件导读] -->
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
