import {describe, expect, it} from 'vitest'
import {createCommand} from '@next/kernel-base-runtime-shell-v2'
import {
    topologyRuntimeV3CommandDefinitions,
} from '@next/kernel-base-topology-runtime-v3'
import {selectUiOverlays} from '@next/kernel-base-ui-runtime-v2'
import {createRuntimeReactHarness} from '../support/runtimeReactHarness'

describe('runtime-react renderer boundary', () => {
    it('does not handle topology power display switch confirmation requests', async () => {
        const harness = await createRuntimeReactHarness()

        await harness.runtime.dispatchCommand(createCommand(
            topologyRuntimeV3CommandDefinitions.requestPowerDisplayModeSwitchConfirmation,
            {
                displayMode: 'SECONDARY',
                reason: 'power-status-change',
                powerConnected: true,
            },
        ))

        expect(selectUiOverlays(harness.runtime.getState())).toEqual([])
    })
})
