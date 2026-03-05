import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Khi bạn gọi axios.post('/api/ai-parser'), Vite sẽ chuyển hướng nó
      '/api': {
        target: 'http://localhost:5173', // ĐỊA CHỈ SERVER NODE.JS CỦA BẠN
        changeOrigin: true,
        timeout: 600000, 
        proxyTimeout: 600000,
      },
    },
  },
})