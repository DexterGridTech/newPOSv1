import {resolve} from 'node:path'
import {createWorkspaceVitestConfig} from '../../../vitest.base.config'

const workspaceRoot = resolve(__dirname, '../../..')

export default createWorkspaceVitestConfig('assembly-android-mixc-catering-rn84', {
    resolve: {
        alias: {
            react: resolve(workspaceRoot, 'node_modules/react'),
            'react/jsx-runtime': resolve(workspaceRoot, 'node_modules/react/jsx-runtime.js'),
            'react/jsx-dev-runtime': resolve(workspaceRoot, 'node_modules/react/jsx-dev-runtime.js'),
            'react-test-renderer': resolve(workspaceRoot, 'node_modules/react-test-renderer'),
            'react-redux': resolve(workspaceRoot, 'node_modules/react-redux'),
            'react-native': 'react-native-web',
            'react-native-qrcode-svg': resolve(__dirname, 'test/support/mockQrCode.tsx'),
        },
    },
    test: {
        environment: 'node',
        include: ['test/**/*.spec.ts', 'test/**/*.spec.tsx'],
        setupFiles: ['test/setup.ts'],
    },
})
