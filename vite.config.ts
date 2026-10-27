import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// 开发环境下将 RPC / 上传请求代理到本机 Transmission 守护进程；
// 可通过环境变量 TRANSMISSION_URL 覆盖，例如 http://192.168.1.10:9091
const target = process.env.TRANSMISSION_URL || 'http://127.0.0.1:9091'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/rpc': { target, changeOrigin: true },
      '/upload': { target, changeOrigin: true },
    },
  },
})
