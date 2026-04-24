import path from 'path'
import {describe, expect, it, vi} from 'vitest'
import fs from 'fs'

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
            '../../../../../2-ui/2.3-integration/catering-shell/src/index.ts',
        )
        const localReactNativePath = path.resolve(
            __dirname,
            '../../node_modules/react-native',
        )
        const originalExistsSync = fs.existsSync.bind(fs)
        const existsSpy = vi.spyOn(fs, 'existsSync').mockImplementation(target =>
            String(target) === localReactNativePath || originalExistsSync(target),
        )

        resolveRequest(
            {
                originModulePath: workspaceSource,
                resolveRequest: delegatedResolve,
            },
            'react-native',
            'android',
        )

        existsSpy.mockRestore()

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
            '../../../../../2-ui/2.3-integration/catering-shell/src/index.ts',
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
