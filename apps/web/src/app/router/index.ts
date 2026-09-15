/* [组件导读]
 * 业务名词：访问令牌用于接口身份验证；Attempt 是一次训练记录，角色分学生、教师和技术人员。
 * 用途：定义页面路由与角色守卫。
 * 为什么与边界：先恢复浏览器会话再检查页面角色；本地状态仅控制导航，不代替后端令牌和资源归属校验。
 * 结构：先看导出的类型或函数，再沿其调用的 API、工具与返回状态理解数据流。
 * [/组件导读] */
import { createRouter, createWebHistory } from 'vue-router'

import { useAuthStore } from '@/features/auth/stores/auth'
import { homePathForRoles } from '@/features/auth/utils/roleNavigation'

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import('@/pages/LoginPage.vue'),
      meta: { public: true },
    },
    {
      path: '/student',
      name: 'student-home',
      component: () => import('@/pages/student/StudentHomePage.vue'),
      meta: { requiredRole: 'student' },
    },
    {
      path: '/student/units/:unitId',
      name: 'unit-preparation',
      component: () => import('@/pages/student/UnitPreparationPage.vue'),
      meta: { requiredRole: 'student' },
    },
    {
      path: '/student/attempts/:attemptId/briefing',
      name: 'attempt-briefing',
      component: () => import('@/pages/student/AttemptBriefingPage.vue'),
      meta: { requiredRole: 'student' },
    },
    {
      path: '/student/attempts/:attemptId',
      name: 'training-workspace',
      component: () => import('@/pages/student/TrainingWorkspacePage.vue'),
      meta: { requiredRole: 'student' },
    },
    {
      path: '/student/attempts/:attemptId/evaluation',
      name: 'evaluation-result',
      component: () => import('@/pages/student/EvaluationPage.vue'),
      meta: { requiredRole: 'student' },
    },
    {
      path: '/student/knowledge-graph',
      name: 'student-knowledge-graph',
      component: () => import('@/pages/student/StudentKnowledgeGraphPage.vue'),
      meta: { requiredRole: 'student' },
    },
    {
      path: '/student/knowledge/:nodeId',
      name: 'student-knowledge-content',
      component: () => import('@/pages/student/StudentKnowledgeContentPage.vue'),
      meta: { requiredRole: 'student' },
    },
    {
      path: '/teacher',
      name: 'teacher-home',
      component: () => import('@/pages/teacher/TeacherHomePage.vue'),
      meta: { requiredRole: 'teacher' },
    },
    {
      path: '/teacher/knowledge-graph',
      name: 'teacher-knowledge-graph',
      component: () => import('@/pages/teacher/TeacherKnowledgeGraphPage.vue'),
      meta: { requiredRole: 'teacher' },
    },
    {
      path: '/teacher/knowledge-content/:nodeId',
      name: 'teacher-knowledge-content',
      component: () => import('@/pages/teacher/TeacherKnowledgeContentPage.vue'),
      meta: { requiredRole: 'teacher' },
    },
    {
      path: '/teacher/students/:studentId',
      name: 'teacher-student-detail',
      component: () => import('@/pages/teacher/TeacherStudentDetailPage.vue'),
      meta: { requiredRole: 'teacher' },
    },
    {
      path: '/teacher/attempts/:attemptId',
      name: 'teacher-attempt-replay',
      component: () => import('@/pages/teacher/TeacherAttemptReplayPage.vue'),
      meta: { requiredRole: 'teacher' },
    },
    {
      path: '/technician',
      name: 'technician-home',
      component: () => import('@/pages/technician/TechnicianHomePage.vue'),
      meta: { requiredRole: 'technician' },
    },
    {
      path: '/forbidden',
      name: 'forbidden',
      component: () => import('@/pages/ForbiddenPage.vue'),
    },
    { path: '/', redirect: '/login' },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
})

// [导读] 守卫只控制页面导航；缓存中的身份和角色不能替代每个后端接口的鉴权与归属检查。
router.beforeEach((to) => {
  const auth = useAuthStore()
  auth.hydrate()
  if (to.meta.public) {
    return auth.isAuthenticated ? homePathForRoles(auth.user?.roles ?? []) : true
  }
  if (!auth.isAuthenticated) return { path: '/login', query: { redirect: to.fullPath } }
  if (to.meta.requiredRole && !auth.hasRole(to.meta.requiredRole)) return '/forbidden'
  return true
})
