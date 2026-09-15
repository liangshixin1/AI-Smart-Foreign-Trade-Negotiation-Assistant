/* [组件导读]
 * 业务名词：访问令牌用于接口身份验证；Attempt 是一次训练记录，角色分学生、教师和技术人员。
 * 用途：初始化 Vue 应用、全局状态、路由与共享样式。
 * 为什么与边界：启动依赖集中挂载，页面和组件才能读取同一套会话与路由上下文。
 * 结构：先看导出的类型或函数，再沿其调用的 API、工具与返回状态理解数据流。
 * [/组件导读] */
import { createPinia } from 'pinia'
import { createApp } from 'vue'

import App from '@/app/App.vue'
import { router } from '@/app/router'
import '@/shared/styles/tokens.css'
import '@/shared/styles/global.css'

createApp(App).use(createPinia()).use(router).mount('#app')
