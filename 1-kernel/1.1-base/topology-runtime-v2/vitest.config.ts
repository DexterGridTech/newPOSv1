import {createWorkspaceVitestConfig} from '../../../vitest.base.config'

export default createWorkspaceVitestConfig('kernel-base-topology-runtime-v2', {
    test: {
        environment: 'node',
        fileParallelism: false,
    },
})
