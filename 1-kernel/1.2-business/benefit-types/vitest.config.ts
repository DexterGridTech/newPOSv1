import {createWorkspaceVitestConfig} from '../../../vitest.base.config'

export default createWorkspaceVitestConfig('kernel-business-benefit-types', {
    test: {
        include: ['test/**/*.spec.ts'],
    },
})
