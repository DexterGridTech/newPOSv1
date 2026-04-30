import {createWorkspaceVitestConfig} from '../../../vitest.base.config'

export default createWorkspaceVitestConfig('kernel-business-benefit-session', {
    test: {
        include: ['test/**/*.spec.ts'],
    },
})
