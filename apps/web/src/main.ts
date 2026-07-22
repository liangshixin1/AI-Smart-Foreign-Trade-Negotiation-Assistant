import { createPinia } from 'pinia'
import { createApp } from 'vue'

import App from '@/app/App.vue'
import { router } from '@/app/router'
import '@/shared/styles/tokens.css'
import '@/shared/styles/global.css'

createApp(App).use(createPinia()).use(router).mount('#app')
