import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import * as path from 'node:path'

// https://vitejs.dev/config
export default defineConfig({
    root: path.join(__dirname, 'dev'),
    cacheDir: path.join(__dirname, '.vite'),
    plugins: [react()],
    resolve: {
        alias: {
            'react-native': 'react-native-web',
        },
    },
    build: {
        outDir: path.join(__dirname, 'dist'),
        emptyOutDir: true,
    },
    clearScreen: false,
    server: {
        port: 1420,
        strictPort: true,
    },
})
