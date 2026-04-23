import {createWorkspaceVitestConfig} from '../../../vitest.base.config'

export default createWorkspaceVitestConfig('kernel-business-organization-iam-master-data', {
    test: {
        include: ['test/**/*.spec.ts'],
    },
})
