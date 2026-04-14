import {describe, expect, it} from 'vitest'
import {createCommand} from '@impos2/kernel-base-runtime-shell-v2'
import {uiRuntimeV2CommandDefinitions} from '../../src'
import {uiRuntimeV2ScreenWorkspaceKeys} from '../../src/features/slices'
import {
    createUiRuntimeV2LiveHarness,
    testPrimaryScreenDefinition,
} from '../helpers/liveHarness'

describe('ui-runtime-v2 live screen master-to-slave', () => {
    it('syncs current screen from master to slave through real dual-topology host flow', async () => {
        const harness = await createUiRuntimeV2LiveHarness({
            profileName: 'dual-topology.ws.ui-runtime-v2.screen.master-to-slave',
        })

        try {
            await harness.configureTopologyPair()
            await harness.waitForSlaveSecondaryMainContext()

            expect((await harness.masterRuntime.dispatchCommand(createCommand(
                uiRuntimeV2CommandDefinitions.showScreen,
                {
                    definition: testPrimaryScreenDefinition,
                    id: 'screen-master-1',
                    props: {orderNo: 'A001'},
                    source: 'live-screen-test',
                },
            ))).status).toBe('COMPLETED')

            await harness.startTopologyConnectionPair()
            await harness.waitForSlaveScreen(testPrimaryScreenDefinition.partKey)

            const slaveState = harness.slaveRuntime.getState() as Record<string, unknown>
            const syncedScreenState = slaveState[uiRuntimeV2ScreenWorkspaceKeys.main] as Record<string, {value?: {partKey?: string; source?: string}}> | undefined

            expect(syncedScreenState?.[testPrimaryScreenDefinition.containerKey!]?.value).toMatchObject({
                partKey: testPrimaryScreenDefinition.partKey,
                source: 'live-screen-test',
            })
        } finally {
            await harness.close()
        }
    })
})
