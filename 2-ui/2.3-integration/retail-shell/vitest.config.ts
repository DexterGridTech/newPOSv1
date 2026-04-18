import {createWorkspaceVitestConfig} from '../../../vitest.base.config'

export default createWorkspaceVitestConfig('ui-integration-retail-shell', {
    resolve: {
        alias: {
            'react-native': 'react-native-web',
        },
    },
    test: {
        environment: 'node',
        include: ['test/**/*.spec.ts', 'test/**/*.spec.tsx'],
        setupFiles: ['test/setup.ts'],
    },
})
