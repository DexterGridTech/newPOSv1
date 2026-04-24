import {describe, expect, it} from 'vitest'
import {
    ASSEMBLY_AUTOMATION_PRIMARY_PORT,
    ASSEMBLY_AUTOMATION_SECONDARY_PORT,
    getAssemblyAutomationHostConfig,
} from '../../src/application/automation/hostConfig'

describe('assembly automation host config', () => {
    it('maps primary display to the primary localhost port', () => {
        expect(getAssemblyAutomationHostConfig(0)).toEqual({
            host: '127.0.0.1',
            port: ASSEMBLY_AUTOMATION_PRIMARY_PORT,
            target: 'primary',
        })
    })

    it('maps secondary displays to the secondary localhost port', () => {
        expect(getAssemblyAutomationHostConfig(1)).toEqual({
            host: '127.0.0.1',
            port: ASSEMBLY_AUTOMATION_SECONDARY_PORT,
            target: 'secondary',
        })
        expect(getAssemblyAutomationHostConfig(2)).toEqual({
            host: '127.0.0.1',
            port: ASSEMBLY_AUTOMATION_SECONDARY_PORT,
            target: 'secondary',
        })
    })
})
