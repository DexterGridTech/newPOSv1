import React from 'react'
import TestRenderer, {act} from 'react-test-renderer'
import {describe, expect, it, vi, beforeEach, afterEach} from 'vitest'
import {createCommand} from '@impos2/kernel-base-runtime-shell-v2'
import {topologyRuntimeV3CommandDefinitions} from '@impos2/kernel-base-topology-runtime-v3'
import {uiRuntimeV2CommandDefinitions} from '@impos2/kernel-base-ui-runtime-v2'
import {
    DefaultAlert,
    UiRuntimeProvider,
} from '../../src'

describe('DefaultAlert', () => {
    beforeEach(() => {
        vi.useFakeTimers()
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    it('runs confirm and cancel commands declared by alert props', async () => {
        const closeCommand = createCommand(uiRuntimeV2CommandDefinitions.closeOverlay, {
            overlayId: 'display-switch-confirm',
        })
        const switchCommand = createCommand(topologyRuntimeV3CommandDefinitions.setDisplayMode, {
            displayMode: 'SECONDARY',
        })
        const dispatchCommand = vi.fn(async () => ({status: 'COMPLETED'}))

        let tree!: TestRenderer.ReactTestRenderer
        await act(async () => {
            tree = TestRenderer.create(
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
        })

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

    it('auto-confirms after countdown when configured', async () => {
        const closeCommand = createCommand(uiRuntimeV2CommandDefinitions.closeOverlay, {
            overlayId: 'display-switch-confirm',
        })
        const confirmCommand = createCommand(topologyRuntimeV3CommandDefinitions.confirmPowerDisplayModeSwitch, {
            displayMode: 'SECONDARY',
        })
        const dispatchCommand = vi.fn(async () => ({status: 'COMPLETED'}))

        let tree!: TestRenderer.ReactTestRenderer
        await act(async () => {
            tree = TestRenderer.create(
                <UiRuntimeProvider runtime={{dispatchCommand} as any}>
                    <DefaultAlert
                        title="切换到副屏"
                        message="检测到电源状态变化，请确认是否切换显示模式。"
                        autoConfirmAfterMs={1_000}
                        confirmText="立即切换"
                        cancelText="取消"
                        confirmAction={{commands: [closeCommand, confirmCommand]}}
                        cancelAction={{commands: [closeCommand]}}
                    />
                </UiRuntimeProvider>,
            )
        })

        expect(tree.root.findByProps({
            testID: 'ui-base-default-alert:countdown',
        }).props.children).toBe('1 秒后自动确认')

        await act(async () => {
            await vi.advanceTimersByTimeAsync(1_000)
            await Promise.resolve()
        })

        expect(dispatchCommand).toHaveBeenNthCalledWith(1, closeCommand)
        expect(dispatchCommand).toHaveBeenNthCalledWith(2, confirmCommand)
    })
})
