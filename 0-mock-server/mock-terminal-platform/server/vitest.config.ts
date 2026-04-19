import {createWorkspaceVitestConfig} from '../../../vitest.base.config'

export default createWorkspaceVitestConfig('mock-terminal-platform-server', {
    test: {
        include: ['src/test/**/*.spec.ts'],
    },
})
