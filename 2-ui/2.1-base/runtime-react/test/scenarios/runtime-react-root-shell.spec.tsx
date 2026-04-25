import React from 'react'
import {describe, expect, it} from 'vitest'
import {createCommand} from '@next/kernel-base-runtime-shell-v2'
import {uiRuntimeV2CommandDefinitions} from '@next/kernel-base-ui-runtime-v2'
import {runtimeReactDefaultParts, UiRuntimeRootShell} from '../../src'
import {createRuntimeReactHarness, renderWithAutomation} from '../support/runtimeReactHarness'

describe('UiRuntimeRootShell', () => {
    it('renders the root shell without introducing router semantics', async () => {
        const harness = await createRuntimeReactHarness()
        const tree = renderWithAutomation(<UiRuntimeRootShell />, harness.store, harness.runtime)

        await expect(tree.getNode('ui-base-root-shell:primary')).resolves.toBeTruthy()
        await expect(tree.getNode('ui-base-screen-container:primary')).resolves.toBeTruthy()
    })

    it('renders default alerts only through the alert host', async () => {
        const harness = await createRuntimeReactHarness()
        await harness.runtime.dispatchCommand(createCommand(
            uiRuntimeV2CommandDefinitions.openOverlay,
            {
                definition: runtimeReactDefaultParts.defaultAlert.definition,
                id: 'display-switch-confirm',
                props: {
                    title: '切换到副屏',
                    message: '检测到电源状态变化，请确认是否切换显示模式。',
                    confirmText: '立即切换',
                    cancelText: '取消',
                },
            },
        ))
        const tree = renderWithAutomation(<UiRuntimeRootShell />, harness.store, harness.runtime)

        expect(tree.tree.root.findAllByProps({testID: 'ui-base-default-alert'})).toHaveLength(1)
        expect(tree.tree.root.findAllByProps({testID: 'ui-base-alert-host'})).toHaveLength(1)
        expect(tree.tree.root.findAllByProps({testID: 'ui-base-overlay-host'})).toHaveLength(1)
    })
})
