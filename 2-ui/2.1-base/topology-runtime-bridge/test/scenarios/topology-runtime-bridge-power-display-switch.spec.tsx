import React from 'react'
import {describe, expect, it} from 'vitest'
import {createCommand} from '@impos2/kernel-base-runtime-shell-v2'
import {
    TOPOLOGY_POWER_DISPLAY_SWITCH_ALERT_ID,
    topologyRuntimeV3CommandDefinitions,
} from '@impos2/kernel-base-topology-runtime-v3'
import {selectUiOverlays} from '@impos2/kernel-base-ui-runtime-v2'
import {UiRuntimeRootShell} from '@impos2/ui-base-runtime-react'
import {
    createTopologyRuntimeBridgeHarness,
    renderWithAutomation,
} from '../support/topologyRuntimeBridgeHarness'

describe('topology runtime bridge power display switch', () => {
    it('opens default alert overlay for topology power display switch confirmation requests', async () => {
        const harness = await createTopologyRuntimeBridgeHarness()
        const tree = renderWithAutomation(
            <UiRuntimeRootShell />,
            harness.store,
            harness.runtime,
        )

        await tree.dispatchCommand(createCommand(
            topologyRuntimeV3CommandDefinitions.requestPowerDisplayModeSwitchConfirmation,
            {
                displayMode: 'SECONDARY',
                reason: 'power-status-change',
                powerConnected: true,
            },
        ))

        const overlays = selectUiOverlays(harness.runtime.getState())
        expect(overlays).toHaveLength(1)
        expect(overlays[0]).toMatchObject({
            id: TOPOLOGY_POWER_DISPLAY_SWITCH_ALERT_ID,
            screenPartKey: 'ui.base.default-alert',
            props: expect.objectContaining({
                title: '切换到副屏',
                autoConfirmAfterMs: 3_000,
                confirmText: '立即切换',
                cancelText: '取消',
                metadata: {
                    reason: 'power-status-change',
                    targetDisplayMode: 'SECONDARY',
                    powerConnected: true,
                },
            }),
        })

        await expect(tree.waitForNode('ui-base-default-alert')).resolves.toBeTruthy()
    })

    it('allows product shells to configure topology power display switch copy and timing', async () => {
        const harness = await createTopologyRuntimeBridgeHarness({
            powerDisplaySwitchAlert: {
                primaryTitle: 'Product Primary',
                secondaryTitle: 'Product Secondary',
                message: 'Product-controlled message',
                confirmText: 'Apply',
                cancelText: 'Later',
                autoConfirmAfterMs: 5_000,
            },
        })

        await harness.runtime.dispatchCommand(createCommand(
            topologyRuntimeV3CommandDefinitions.requestPowerDisplayModeSwitchConfirmation,
            {
                displayMode: 'PRIMARY',
                reason: 'power-status-change',
                powerConnected: false,
            },
        ))

        expect(selectUiOverlays(harness.runtime.getState())[0]).toMatchObject({
            id: TOPOLOGY_POWER_DISPLAY_SWITCH_ALERT_ID,
            props: expect.objectContaining({
                title: 'Product Primary',
                message: 'Product-controlled message',
                autoConfirmAfterMs: 5_000,
                confirmText: 'Apply',
                cancelText: 'Later',
            }),
        })
    })
})
