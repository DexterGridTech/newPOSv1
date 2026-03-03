import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

export default defineConfig({
    root: path.join(__dirname, '..'),
    plugins: [react()],
    resolve: {
        alias: {
            'react-native': 'react-native-web',
        },
    },
})
