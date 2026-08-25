import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    proxy: {
      // Khi bạn gọi axios.post('/api/ai-parser'), Vite sẽ chuyển hướng nó
      '/api': {
        target: 'http://localhost:5000', // Express server (see server/index.js)
        changeOrigin: true,
        timeout: 600000, 
        proxyTimeout: 600000,
      },
    },
  },
})
