import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import pkg from './package.json'

// 开发环境下将 RPC / 上传请求代理到本机 Transmission 守护进程；
// 可通过环境变量 TRANSMISSION_URL 覆盖，例如 http://192.168.1.10:9091
const target = process.env.TRANSMISSION_URL || 'http://127.0.0.1:9091'

export default defineConfig({
  // 相对资源路径：产物可部署在任意子目录（Transmission 的 /transmission/web/ 等）
  base: './',
  // 构建期注入版本号（About/状态栏显示，与 Release tag 对应）
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/rpc': { target, changeOrigin: true },
      '/upload': { target, changeOrigin: true },
    },
  },
})
