import {describe, expect, it} from 'vitest'
import {createAutomationRuntime} from '../../src/application'

describe('automation target registry', () => {
    it('starts inert until targets are explicitly registered', () => {
        const runtime = createAutomationRuntime({buildProfile: 'test'})
        expect(runtime.hello().availableTargets).toEqual(['host'])
        expect(runtime.hello().productMode).toBe(false)
    })

    it('registers and unregisters primary and secondary independently', () => {
        const runtime = createAutomationRuntime({buildProfile: 'test'})
        const unregisterPrimary = runtime.registerTarget({target: 'primary', runtimeId: 'primary-1'})
        const unregisterSecondary = runtime.registerTarget({target: 'secondary', runtimeId: 'secondary-1'})

        expect(runtime.hello().availableTargets).toEqual(['host', 'primary', 'secondary'])

        unregisterPrimary()
        expect(runtime.hello().availableTargets).toEqual(['host', 'secondary'])

        unregisterSecondary()
        expect(runtime.hello().availableTargets).toEqual(['host'])
    })

    it('does not expose script execution in product mode', () => {
        const runtime = createAutomationRuntime({
            buildProfile: 'product',
            scriptExecutionAvailable: true,
        })

        expect(runtime.hello().productMode).toBe(true)
        expect(runtime.hello().scriptExecutionAvailable).toBe(false)
    })
})
