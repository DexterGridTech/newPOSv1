import React from 'react'
import TestRenderer, {act} from 'react-test-renderer'
import {describe, expect, it, vi} from 'vitest'
import {createCommand} from '@impos2/kernel-base-runtime-shell-v2'
import {topologyRuntimeV3CommandDefinitions} from '@impos2/kernel-base-topology-runtime-v3'
import {uiRuntimeV2CommandDefinitions} from '@impos2/kernel-base-ui-runtime-v2'
import {
    DefaultAlert,
    UiRuntimeProvider,
} from '../../src'

describe('DefaultAlert', () => {
    it('runs confirm and cancel commands declared by alert props', async () => {
        const closeCommand = createCommand(uiRuntimeV2CommandDefinitions.closeOverlay, {
            overlayId: 'display-switch-confirm',
        })
        const switchCommand = createCommand(topologyRuntimeV3CommandDefinitions.setDisplayMode, {
            displayMode: 'SECONDARY',
        })
        const dispatchCommand = vi.fn(async () => ({status: 'COMPLETED'}))

        const tree = TestRenderer.create(
            <UiRuntimeProvider runtime={{dispatchCommand} as any}>
                <DefaultAlert
                    title="切换到副屏"
                    message="检测到电源状态变化，请确认是否切换显示模式。"
                    confirmText="立即切换"
                    cancelText="取消"
                    confirmAction={{commands: [closeCommand, switchCommand]}}
                    cancelAction={{commands: [closeCommand]}}
                />
            </UiRuntimeProvider>,
        )

        await act(async () => {
            await tree.root.findByProps({testID: 'ui-base-default-alert:confirm'}).props.onPress()
        })

        expect(dispatchCommand).toHaveBeenNthCalledWith(1, closeCommand)
        expect(dispatchCommand).toHaveBeenNthCalledWith(2, switchCommand)

        dispatchCommand.mockClear()

        await act(async () => {
            await tree.root.findByProps({testID: 'ui-base-default-alert:cancel'}).props.onPress()
        })

        expect(dispatchCommand).toHaveBeenCalledTimes(1)
        expect(dispatchCommand).toHaveBeenCalledWith(closeCommand)
    })
})
