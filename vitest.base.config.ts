import {dirname, resolve} from 'node:path'
import {fileURLToPath} from 'node:url'
import {defineConfig} from 'vitest/config'

const workspaceRoot = dirname(fileURLToPath(import.meta.url))

export const createWorkspaceVitestConfig = (workspaceName: string) => defineConfig({
    cacheDir: resolve(workspaceRoot, 'node_modules/.vite/vitest', workspaceName),
    test: {
        environment: 'node',
    },
})
