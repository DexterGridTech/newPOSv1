import {createWorkspaceVitestConfig} from '../../../vitest.base.config'

export default createWorkspaceVitestConfig('kernel-base-tdp-sync-runtime-v2', {
    test: {
        include: ['test/**/*.spec.ts'],
        fileParallelism: false,
    },
})
