import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/kernel-server/',
  build: {
    outDir: 'dist'
  },
  server: {
    port: 3000,
    proxy: {
      '/kernel-server/api': {
        target: 'http://localhost:9999',
        changeOrigin: true
      },
      '/kernel-server/sse': {
        target: 'http://localhost:9999',
        changeOrigin: true
      },
      '/kernel-server/manager': {
        target: 'http://localhost:9999',
        changeOrigin: true
      },
      '/kernel-server/ws': {
        target: 'ws://localhost:9999',
        ws: true,
        changeOrigin: true,
        configure: (proxy, _options) => {
          proxy.on('error', (err, _req, _res) => {
            // 忽略 EPIPE 和 ECONNRESET 错误，这些是客户端断开连接时的正常情况
            if (err.code === 'EPIPE' || err.code === 'ECONNRESET') {
              return;
            }
            console.error('[Vite Proxy] WebSocket proxy error:', err);
          });
          proxy.on('proxyReqWs', (_proxyReq, _req, socket) => {
            // 处理 socket 错误，避免未捕获的异常
            socket.on('error', (err: any) => {
              if (err.code === 'EPIPE' || err.code === 'ECONNRESET') {
                return;
              }
              console.error('[Vite Proxy] Socket error:', err);
            });
          });
        }
      }
    }
  }
});
