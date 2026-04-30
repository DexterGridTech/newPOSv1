import {createWorkspaceVitestConfig} from '../../../vitest.base.config'

export default createWorkspaceVitestConfig('kernel-business-benefit-calculation', {
    test: {
        include: ['test/**/*.spec.ts'],
    },
})
