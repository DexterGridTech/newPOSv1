import {createWorkspaceVitestConfig} from '../../../vitest.base.config'

export default createWorkspaceVitestConfig('ui-base-automation-runtime', {
    resolve: {
        alias: {
            'react-native': 'react-native-web',
        },
    },
    test: {
        environment: 'node',
        include: ['test/**/*.spec.ts', 'test/**/*.spec.tsx'],
    },
})
