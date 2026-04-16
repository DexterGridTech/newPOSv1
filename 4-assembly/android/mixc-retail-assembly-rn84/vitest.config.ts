import {createWorkspaceVitestConfig} from '../../../vitest.base.config'

export default createWorkspaceVitestConfig('assembly-android-mixc-retail-rn84', {
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
