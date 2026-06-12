import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // 生产构建由 Flask 托管在 /modern/，开发时仍使用 Vite 热更新服务器。
  base: '/modern/',
  plugins: [react()],
  build: {
    outDir: '../static/modern',
    emptyOutDir: true,
  },
  server: {
    proxy: {
      '/api': 'http://localhost:5000',
    },
  },
})
