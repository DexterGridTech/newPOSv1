import {describe, expect, it} from 'vitest'
import {createCommand} from '@next/kernel-base-runtime-shell-v2'
import {uiRuntimeV2CommandDefinitions} from '../../src'
import {uiRuntimeV2VariableWorkspaceKeys} from '../../src/features/slices'
import {createUiRuntimeV2LiveHarness} from '../helpers/liveHarness'

describe('ui-runtime-v2 live ui-variables master-to-slave', () => {
    it('syncs ui variables and explicit clear semantics through real dual-topology host flow', async () => {
        const harness = await createUiRuntimeV2LiveHarness({
            profileName: 'dual-topology.ws.ui-runtime-v2.ui-variable.master-to-slave',
        })

        try {
            await harness.configureTopologyPair()
            await harness.waitForSlaveSecondaryMainContext()
            await harness.startTopologyConnectionPair()

            expect((await harness.masterRuntime.dispatchCommand(createCommand(
                uiRuntimeV2CommandDefinitions.setUiVariables,
                {
                    orderNo: 'A001',
                    amount: 128,
                    note: 'cash only',
                },
            ))).status).toBe('COMPLETED')

            await harness.waitForSlaveVariable('orderNo', value => value === 'A001')
            await harness.waitForSlaveVariable('amount', value => value === 128)
            await harness.waitForSlaveVariable('note', value => value === 'cash only')

            const slaveState = harness.slaveRuntime.getState() as Record<string, unknown>
            const variableState = slaveState[uiRuntimeV2VariableWorkspaceKeys.main] as Record<string, {value?: unknown | null}> | undefined
            expect(variableState?.orderNo?.value).toBe('A001')
            expect(variableState?.amount?.value).toBe(128)
            expect(variableState?.note?.value).toBe('cash only')

            expect((await harness.masterRuntime.dispatchCommand(createCommand(
                uiRuntimeV2CommandDefinitions.clearUiVariables,
                ['note'],
            ))).status).toBe('COMPLETED')

            await harness.waitForSlaveVariable('note', value => value === null)
            const nextSlaveState = harness.slaveRuntime.getState() as Record<string, unknown>
            const nextVariableState = nextSlaveState[uiRuntimeV2VariableWorkspaceKeys.main] as Record<string, {value?: unknown | null}> | undefined
            expect(nextVariableState?.note?.value).toBeNull()
        } finally {
            await harness.close()
        }
    })
})
