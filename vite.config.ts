import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react()],
    server: {
      port: 3000,
      strictPort: true,
      proxy: {
        '/api': { target: env.BACKEND_PROXY_TARGET || 'http://localhost:8080', changeOrigin: true },
      },
    },
    build: { target: 'es2022', sourcemap: false },
  }
})
