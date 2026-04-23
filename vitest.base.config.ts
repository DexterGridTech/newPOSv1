import {dirname, resolve} from 'node:path'
import {fileURLToPath} from 'node:url'
import {
    defineConfig,
    mergeConfig,
    type UserConfig,
} from 'vitest/config'

const workspaceRoot = dirname(fileURLToPath(import.meta.url))

const createBaseWorkspaceVitestConfig = (workspaceName: string) => defineConfig({
    cacheDir: resolve(workspaceRoot, 'node_modules/.vite/vitest', workspaceName),
    test: {
        environment: 'node',
    },
})

export const createWorkspaceVitestConfig = (
    workspaceName: string,
    overrides?: UserConfig,
) => {
    const baseConfig = createBaseWorkspaceVitestConfig(workspaceName)
    if (!overrides) {
        return baseConfig
    }
    return mergeConfig(baseConfig, defineConfig(overrides))
}
