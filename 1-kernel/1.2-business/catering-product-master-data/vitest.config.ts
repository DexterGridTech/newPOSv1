import {createWorkspaceVitestConfig} from '../../../vitest.base.config'

export default createWorkspaceVitestConfig('kernel-business-catering-product-master-data', {
    test: {
        include: ['test/**/*.spec.ts'],
    },
})
