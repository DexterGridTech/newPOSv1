import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

const rnWebPath = path.resolve(__dirname, '../../../../node_modules/react-native-web')

export default defineConfig({
    root: path.join(__dirname, '..'),
    define: {
        global: 'globalThis',
    },
    plugins: [
        react({
            babel: {
                plugins: [['@babel/plugin-transform-flow-strip-types', { requireDirective: false }]],
                babelrc: false,
                configFile: false,
            },
            include: [/\.tsx?$/, /\.jsx?$/, /node_modules\/@react-native/],
        }),
    ],
    resolve: {
        alias: {
            'react-native': rnWebPath,
            'react-native/Libraries/Utilities/codegenNativeComponent': path.join(rnWebPath, 'dist/cjs/modules/UnimplementedView'),
            '@react-native/assets-registry/registry': path.join(__dirname, 'assets-registry-shim.js'),
            '@react-native/assets-registry': path.join(__dirname, 'assets-registry-shim.js'),
        },
    },
    esbuild: {
        loader: 'tsx',
        include: /\.(tsx?|jsx?)$/,
    },
    optimizeDeps: {
        esbuildOptions: {
            target: 'esnext',
            loader: {
                '.js': 'tsx',
            },
            resolveExtensions: ['.web.js', '.web.ts', '.web.tsx', '.js', '.jsx', '.ts', '.tsx', '.json'],
        },
    },
})
