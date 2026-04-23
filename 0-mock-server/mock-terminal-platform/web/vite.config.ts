import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5820,
    proxy: {
      '/api': 'http://127.0.0.1:5810',
      '/internal': 'http://127.0.0.1:5810',
      '/mock-admin': 'http://127.0.0.1:5810',
      '/mock-debug': 'http://127.0.0.1:5810'
    }
  }
})
