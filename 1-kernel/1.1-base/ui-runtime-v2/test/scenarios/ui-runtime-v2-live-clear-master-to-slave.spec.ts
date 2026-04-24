import {describe, expect, it} from 'vitest'
import {createCommand} from '@next/kernel-base-runtime-shell-v2'
import {uiRuntimeV2CommandDefinitions} from '../../src'
import {
    uiRuntimeV2OverlayWorkspaceKeys,
    uiRuntimeV2ScreenWorkspaceKeys,
    uiRuntimeV2VariableWorkspaceKeys,
} from '../../src/features/slices'
import {
    createUiRuntimeV2LiveHarness,
    testModalDefinition,
    testPrimaryScreenDefinition,
} from '../helpers/liveHarness'

describe('ui-runtime-v2 live clear semantics master-to-slave', () => {
    it('syncs screen reset, overlay clear, and ui-variable clear through real dual-topology host flow', async () => {
        const harness = await createUiRuntimeV2LiveHarness({
            profileName: 'dual-topology.ws.ui-runtime-v2.clear.master-to-slave',
        })

        try {
            await harness.configureTopologyPair()
            await harness.waitForSlaveSecondaryMainContext()
            await harness.startTopologyConnectionPair()

            expect((await harness.masterRuntime.dispatchCommand(createCommand(
                uiRuntimeV2CommandDefinitions.showScreen,
                {
                    definition: testPrimaryScreenDefinition,
                    id: 'screen-clear-1',
                    props: {orderNo: 'A002'},
                    source: 'live-clear-test',
                },
            ))).status).toBe('COMPLETED')
            expect((await harness.masterRuntime.dispatchCommand(createCommand(
                uiRuntimeV2CommandDefinitions.openOverlay,
                {
                    definition: testModalDefinition,
                    id: 'overlay-clear-1',
                    props: {amount: 256},
                },
            ))).status).toBe('COMPLETED')
            expect((await harness.masterRuntime.dispatchCommand(createCommand(
                uiRuntimeV2CommandDefinitions.setUiVariables,
                {
                    orderNo: 'A002',
                    amount: 256,
                },
            ))).status).toBe('COMPLETED')

            await harness.waitForSlaveScreen(testPrimaryScreenDefinition.partKey)
            await harness.waitForSlaveOverlayCount(1)
            await harness.waitForSlaveVariable('orderNo', value => value === 'A002')

            expect((await harness.masterRuntime.dispatchCommand(createCommand(
                uiRuntimeV2CommandDefinitions.resetScreen,
                {
                    containerKey: testPrimaryScreenDefinition.containerKey!,
                },
            ))).status).toBe('COMPLETED')
            expect((await harness.masterRuntime.dispatchCommand(createCommand(
                uiRuntimeV2CommandDefinitions.clearOverlays,
                {},
            ))).status).toBe('COMPLETED')
            expect((await harness.masterRuntime.dispatchCommand(createCommand(
                uiRuntimeV2CommandDefinitions.clearUiVariables,
                ['orderNo', 'amount'],
            ))).status).toBe('COMPLETED')

            await harness.waitForSlaveOverlayCount(0)
            await harness.waitForSlaveVariable('orderNo', value => value === null)
            await harness.waitForSlaveVariable('amount', value => value === null)

            const slaveState = harness.slaveRuntime.getState() as Record<string, unknown>
            const screenState = slaveState[uiRuntimeV2ScreenWorkspaceKeys.main] as Record<string, {value?: unknown | null}> | undefined
            const overlayState = slaveState[uiRuntimeV2OverlayWorkspaceKeys.main] as {primaryOverlays?: {value?: unknown[]}} | undefined
            const variableState = slaveState[uiRuntimeV2VariableWorkspaceKeys.main] as Record<string, {value?: unknown | null}> | undefined

            expect(screenState?.[testPrimaryScreenDefinition.containerKey!]?.value).toBeNull()
            expect(overlayState?.primaryOverlays?.value ?? []).toEqual([])
            expect(variableState?.orderNo?.value).toBeNull()
            expect(variableState?.amount?.value).toBeNull()
        } finally {
            await harness.close()
        }
    })
})
