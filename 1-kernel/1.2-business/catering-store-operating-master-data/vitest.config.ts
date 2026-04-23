import {createWorkspaceVitestConfig} from '../../../vitest.base.config'

export default createWorkspaceVitestConfig('kernel-business-catering-store-operating-master-data', {
    test: {
        include: ['test/**/*.spec.ts'],
    },
})
