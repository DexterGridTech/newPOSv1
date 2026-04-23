import {describe, expect, it} from 'vitest'
import {createCommand} from '@impos2/kernel-base-runtime-shell-v2'
import {uiRuntimeV2CommandDefinitions} from '../../src'
import {uiRuntimeV2OverlayWorkspaceKeys} from '../../src/features/slices'
import {
    createUiRuntimeV2LiveHarness,
    testModalDefinition,
} from '../helpers/liveHarness'

describe('ui-runtime-v2 live overlay master-to-slave', () => {
    it('syncs overlay open and close from master to slave through real dual-topology host flow', async () => {
        const harness = await createUiRuntimeV2LiveHarness({
            profileName: 'dual-topology.ws.ui-runtime-v2.overlay.master-to-slave',
        })

        try {
            await harness.configureTopologyPair()
            await harness.waitForSlaveSecondaryMainContext()
            await harness.startTopologyConnectionPair()

            expect((await harness.masterRuntime.dispatchCommand(createCommand(
                uiRuntimeV2CommandDefinitions.openOverlay,
                {
                    definition: testModalDefinition,
                    id: 'overlay-live-1',
                    props: {amount: 128},
                },
            ))).status).toBe('COMPLETED')

            await harness.waitForSlaveOverlayCount(1)
            const slaveState = harness.slaveRuntime.getState() as Record<string, unknown>
            const overlayState = slaveState[uiRuntimeV2OverlayWorkspaceKeys.main] as {primaryOverlays?: {value?: unknown[]}} | undefined
            expect((overlayState?.primaryOverlays?.value ?? [])[0]).toMatchObject({
                id: 'overlay-live-1',
                screenPartKey: testModalDefinition.partKey,
            })

            expect((await harness.masterRuntime.dispatchCommand(createCommand(
                uiRuntimeV2CommandDefinitions.closeOverlay,
                {
                    overlayId: 'overlay-live-1',
                },
            ))).status).toBe('COMPLETED')

            await harness.waitForSlaveOverlayCount(0)
            const nextSlaveState = harness.slaveRuntime.getState() as Record<string, unknown>
            const nextOverlayState = nextSlaveState[uiRuntimeV2OverlayWorkspaceKeys.main] as {primaryOverlays?: {value?: unknown[]}} | undefined
            expect(nextOverlayState?.primaryOverlays?.value ?? []).toEqual([])
        } finally {
            await harness.close()
        }
    })
})
