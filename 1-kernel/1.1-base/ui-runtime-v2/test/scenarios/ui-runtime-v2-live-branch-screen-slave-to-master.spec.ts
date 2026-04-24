import {describe, expect, it} from 'vitest'
import {createCommand} from '@next/kernel-base-runtime-shell-v2'
import {uiRuntimeV2CommandDefinitions} from '../../src'
import {uiRuntimeV2ScreenWorkspaceKeys} from '../../src/features/slices'
import {
    createUiRuntimeV2LiveHarness,
    testSecondaryScreenDefinition,
} from '../helpers/liveHarness'

describe('ui-runtime-v2 live branch screen slave-to-master', () => {
    it('syncs branch workspace screen from slave back to master through real dual-topology host flow', async () => {
        const harness = await createUiRuntimeV2LiveHarness({
            profileName: 'dual-topology.ws.ui-runtime-v2.branch-screen.slave-to-master',
            slaveDisplayIndex: 0,
            slaveDisplayCount: 1,
            slaveDisplayMode: 'PRIMARY',
        })

        try {
            await harness.configureTopologyPair()
            await harness.waitForSlaveContext({
                displayMode: 'PRIMARY',
                workspace: 'BRANCH',
            })
            await harness.startTopologyConnectionPair()

            expect((await harness.slaveRuntime.dispatchCommand(createCommand(
                uiRuntimeV2CommandDefinitions.showScreen,
                {
                    definition: testSecondaryScreenDefinition,
                    id: 'screen-branch-1',
                    props: {ticketNo: 'B001'},
                    source: 'branch-live-test',
                },
            ))).status).toBe('COMPLETED')

            const containerKey = testSecondaryScreenDefinition.containerKey!

            await new Promise(resolve => setTimeout(resolve, 50))

            const masterState = harness.masterRuntime.getState() as Record<string, unknown>
            const branchScreenState = masterState[uiRuntimeV2ScreenWorkspaceKeys.branch] as Record<string, {value?: {partKey?: string; source?: string}}> | undefined

            expect(branchScreenState?.[containerKey]?.value).toMatchObject({
                partKey: testSecondaryScreenDefinition.partKey,
                source: 'branch-live-test',
            })
        } finally {
            await harness.close()
        }
    })
})
