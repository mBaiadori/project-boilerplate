import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const frontendPort = Number(process.env.VITE_PORT) || 5173
const backendPort = Number(process.env.VITE_BACKEND_PORT) || Number(process.env.PORT) || 4100

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: frontendPort,
    proxy: {
      '/api': {
        target: `http://127.0.0.1:${backendPort}`,
        changeOrigin: true,
        secure: false,
      }
    }
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  }
})

