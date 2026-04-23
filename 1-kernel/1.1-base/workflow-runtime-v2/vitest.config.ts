import {createWorkspaceVitestConfig} from '../../../vitest.base.config'

export default createWorkspaceVitestConfig('kernel-base-workflow-runtime-v2', {
    test: {
        include: ['test/**/*.spec.ts'],
    },
})
