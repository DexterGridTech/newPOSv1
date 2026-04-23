import {createWorkspaceVitestConfig} from '../../../vitest.base.config'

export default createWorkspaceVitestConfig('kernel-base-tcp-control-runtime-v2', {
    test: {
        include: ['test/**/*.spec.ts'],
    },
})
