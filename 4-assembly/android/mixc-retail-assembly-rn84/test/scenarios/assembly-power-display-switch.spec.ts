import {describe, expect, it, vi} from 'vitest'
import {createCommand} from '@impos2/kernel-base-runtime-shell-v2'
import {uiRuntimeV2CommandDefinitions} from '@impos2/kernel-base-ui-runtime-v2'
import {topologyRuntimeV3CommandDefinitions} from '@impos2/kernel-base-topology-runtime-v3'
import {
    ASSEMBLY_POWER_DISPLAY_SWITCH_ALERT_ID,
    handleAssemblyPowerDisplaySwitch,
} from '../../src/application/topology'

describe('assembly power display switch', () => {
    it('opens confirmation alert for standalone slave primary to secondary when power connects', async () => {
        const dispatchCommand = vi.fn(async () => ({status: 'COMPLETED'}))

        await handleAssemblyPowerDisplaySwitch({
            context: {standalone: true, instanceMode: 'SLAVE', displayMode: 'PRIMARY'},
            powerConnected: true,
            dispatchCommand,
        })

        expect(dispatchCommand).toHaveBeenCalledWith(expect.objectContaining({
            definition: expect.objectContaining({
                commandName: uiRuntimeV2CommandDefinitions.openOverlay.commandName,
            }),
            payload: expect.objectContaining({
                id: ASSEMBLY_POWER_DISPLAY_SWITCH_ALERT_ID,
                props: expect.objectContaining({
                    title: '切换到副屏',
                    confirmText: '立即切换',
                    cancelText: '取消',
                    confirmAction: {
                        commands: [
                            createCommand(uiRuntimeV2CommandDefinitions.closeOverlay, {
                                overlayId: ASSEMBLY_POWER_DISPLAY_SWITCH_ALERT_ID,
                            }),
                            createCommand(topologyRuntimeV3CommandDefinitions.setDisplayMode, {
                                displayMode: 'SECONDARY',
                            }),
                        ],
                    },
                    cancelAction: {
                        commands: [
                            createCommand(uiRuntimeV2CommandDefinitions.closeOverlay, {
                                overlayId: ASSEMBLY_POWER_DISPLAY_SWITCH_ALERT_ID,
                            }),
                        ],
                    },
                }),
            }),
        }))
    })

    it('opens confirmation alert for standalone slave secondary to primary when power disconnects', async () => {
        const dispatchCommand = vi.fn(async () => ({status: 'COMPLETED'}))

        await handleAssemblyPowerDisplaySwitch({
            context: {standalone: true, instanceMode: 'SLAVE', displayMode: 'SECONDARY'},
            powerConnected: false,
            dispatchCommand,
        })

        expect(dispatchCommand).toHaveBeenCalledWith(expect.objectContaining({
            definition: expect.objectContaining({
                commandName: uiRuntimeV2CommandDefinitions.openOverlay.commandName,
            }),
            payload: expect.objectContaining({
                id: ASSEMBLY_POWER_DISPLAY_SWITCH_ALERT_ID,
                props: expect.objectContaining({
                    title: '切换到主屏',
                    confirmAction: {
                        commands: [
                            createCommand(uiRuntimeV2CommandDefinitions.closeOverlay, {
                                overlayId: ASSEMBLY_POWER_DISPLAY_SWITCH_ALERT_ID,
                            }),
                            createCommand(topologyRuntimeV3CommandDefinitions.setDisplayMode, {
                                displayMode: 'PRIMARY',
                            }),
                        ],
                    },
                }),
            }),
        }))
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
