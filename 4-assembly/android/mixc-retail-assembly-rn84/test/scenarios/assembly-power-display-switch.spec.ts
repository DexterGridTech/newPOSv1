import {describe, expect, it, vi} from 'vitest'
import {createCommand} from '@impos2/kernel-base-runtime-shell-v2'
import {topologyRuntimeV3CommandDefinitions} from '@impos2/kernel-base-topology-runtime-v3'
import {handleAssemblyPowerDisplaySwitch} from '../../src/application/topology'

describe('assembly power display switch', () => {
    it('switches standalone slave primary to secondary when power connects', async () => {
        const dispatchCommand = vi.fn(async () => ({status: 'COMPLETED'}))

        await handleAssemblyPowerDisplaySwitch({
            context: {standalone: true, instanceMode: 'SLAVE', displayMode: 'PRIMARY'},
            powerConnected: true,
            dispatchCommand,
        })

        expect(dispatchCommand).toHaveBeenCalledWith(createCommand(
            topologyRuntimeV3CommandDefinitions.setDisplayMode,
            {displayMode: 'SECONDARY'},
        ))
    })

    it('switches standalone slave secondary to primary when power disconnects', async () => {
        const dispatchCommand = vi.fn(async () => ({status: 'COMPLETED'}))

        await handleAssemblyPowerDisplaySwitch({
            context: {standalone: true, instanceMode: 'SLAVE', displayMode: 'SECONDARY'},
            powerConnected: false,
            dispatchCommand,
        })

        expect(dispatchCommand).toHaveBeenCalledWith(createCommand(
            topologyRuntimeV3CommandDefinitions.setDisplayMode,
            {displayMode: 'PRIMARY'},
        ))
    })

    it('does not switch managed secondary', async () => {
        const dispatchCommand = vi.fn()

        await handleAssemblyPowerDisplaySwitch({
            context: {standalone: false, instanceMode: 'SLAVE', displayMode: 'SECONDARY'},
            powerConnected: false,
            dispatchCommand,
        })

        expect(dispatchCommand).not.toHaveBeenCalled()
    })

    it('does not switch master contexts', async () => {
        const dispatchCommand = vi.fn()

        await handleAssemblyPowerDisplaySwitch({
            context: {standalone: true, instanceMode: 'MASTER', displayMode: 'PRIMARY'},
            powerConnected: true,
            dispatchCommand,
        })

        expect(dispatchCommand).not.toHaveBeenCalled()
    })
})
