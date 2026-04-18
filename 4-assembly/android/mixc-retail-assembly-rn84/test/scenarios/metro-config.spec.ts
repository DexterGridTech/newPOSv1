import path from 'path'
import {describe, expect, it, vi} from 'vitest'

const metroConfig = require('../../metro.config.js')

describe('assembly metro config', () => {
    it('redirects react-native requests from workspace sources to local RN84 dependencies', () => {
        const resolveRequest = metroConfig.resolver?.resolveRequest
        expect(typeof resolveRequest).toBe('function')

        const delegatedResolve = vi.fn((context: any, moduleName: string, platform: string | null) => ({
            type: 'sourceFile',
            filePath: JSON.stringify({
                originModulePath: context.originModulePath,
                moduleName,
                platform,
            }),
        }))

        const workspaceSource = path.resolve(
            __dirname,
            '../../../../../2-ui/2.3-integration/retail-shell/src/index.ts',
        )

        resolveRequest(
            {
                originModulePath: workspaceSource,
                resolveRequest: delegatedResolve,
            },
            'react-native',
            'android',
        )

        expect(delegatedResolve).toHaveBeenCalledTimes(1)
        const delegatedContext = delegatedResolve.mock.calls[0]?.[0] as {originModulePath: string}
        expect(delegatedContext.originModulePath).toBe(
            path.resolve(
                __dirname,
                '../../node_modules/react-native/index.js',
            ),
        )
    })

    it('keeps workspace package imports on the normal monorepo resolution path', () => {
        const resolveRequest = metroConfig.resolver?.resolveRequest
        expect(typeof resolveRequest).toBe('function')

        const delegatedResolve = vi.fn((context: any) => ({
            type: 'sourceFile',
            filePath: context.originModulePath,
        }))

        const workspaceSource = path.resolve(
            __dirname,
            '../../../../../2-ui/2.3-integration/retail-shell/src/index.ts',
        )

        resolveRequest(
            {
                originModulePath: workspaceSource,
                resolveRequest: delegatedResolve,
            },
            '@impos2/ui-base-runtime-react',
            'android',
        )

        expect(delegatedResolve).toHaveBeenCalledTimes(1)
        const delegatedContext = delegatedResolve.mock.calls[0]?.[0] as {originModulePath: string}
        expect(delegatedContext.originModulePath).toBe(workspaceSource)
    })
})
