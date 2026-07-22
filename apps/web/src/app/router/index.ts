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
