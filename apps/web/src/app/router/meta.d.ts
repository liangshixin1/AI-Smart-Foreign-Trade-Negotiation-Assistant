import 'vue-router'

declare module 'vue-router' {
  interface RouteMeta {
    public?: boolean
    requiredRole?: 'student' | 'teacher' | 'technician'
  }
}
