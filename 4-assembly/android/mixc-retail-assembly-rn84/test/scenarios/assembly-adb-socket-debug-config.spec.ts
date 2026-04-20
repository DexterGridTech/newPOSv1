import {describe, expect, it} from 'vitest'
import {
    resolveAssemblyAdbSocketDebugConfig,
    isAssemblyAdbSocketDebugEnabled,
} from '../../src/application/automation/adbSocketDebugConfig'

describe('assembly adb socket debug config', () => {
    it('reads the package-level switch as enabled', () => {
        expect(isAssemblyAdbSocketDebugEnabled()).toBe(true)
    })

    it('maps enabled DEV builds to debug automation', () => {
        expect(resolveAssemblyAdbSocketDebugConfig({
            enabled: true,
            environmentMode: 'DEV',
        })).toEqual({
            enabled: true,
            buildProfile: 'debug',
            scriptExecutionAvailable: true,
        })
    })

    it('maps enabled PROD builds to internal automation', () => {
        expect(resolveAssemblyAdbSocketDebugConfig({
            enabled: true,
            environmentMode: 'PROD',
        })).toEqual({
            enabled: true,
            buildProfile: 'internal',
            scriptExecutionAvailable: true,
        })
    })

    it('fully disables automation when the switch is off', () => {
        expect(resolveAssemblyAdbSocketDebugConfig({
            enabled: false,
            environmentMode: 'DEV',
        })).toEqual({
            enabled: false,
            buildProfile: 'product',
            scriptExecutionAvailable: false,
        })
        expect(resolveAssemblyAdbSocketDebugConfig({
            enabled: false,
            environmentMode: 'PROD',
        })).toEqual({
            enabled: false,
            buildProfile: 'product',
            scriptExecutionAvailable: false,
        })
    })
})
