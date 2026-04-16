import React from 'react'
import {describe, expect, it, vi} from 'vitest'
import {act} from 'react-test-renderer'
import {
    createCommand,
    runtimeShellV2CommandDefinitions,
} from '@impos2/kernel-base-runtime-shell-v2'
import {tcpControlV2StateActions} from '@impos2/kernel-base-tcp-control-runtime-v2'
import {RootScreen} from '../../src'
import {createRetailShellHarness, renderWithStore} from '../support/retailShellHarness'

vi.mock('@impos2/ui-base-admin-console', async () => {
    const ReactModule = await import('react')
    const actual = await vi.importActual<typeof import('@impos2/ui-base-admin-console')>('@impos2/ui-base-admin-console')

    return {
        ...actual,
        AdminPopup: ({deviceId, onClose}: {deviceId: string; onClose: () => void}) =>
            ReactModule.createElement('mock-admin-popup', {
                testID: 'ui-base-admin-popup:login',
                deviceId,
                onClose,
            }),
    }
})

describe('retail-shell root screen', () => {
    it('renders the ui runtime root shell host', async () => {
        const harness = await createRetailShellHarness()
        harness.store.dispatch(tcpControlV2StateActions.setActivatedIdentity({
            terminalId: 'terminal-root-001',
            activatedAt: Date.now(),
        }))
        await harness.runtime.dispatchCommand(createCommand(
            runtimeShellV2CommandDefinitions.initialize,
            {},
        ))

        const tree = renderWithStore(
            <RootScreen deviceId="DEVICE-001" />,
            harness.store,
            harness.runtime,
        )

        expect(tree.toJSON()).toBeTruthy()
    })

    it('opens admin popup through repeated top-left presses', async () => {
        const harness = await createRetailShellHarness()
        harness.store.dispatch(tcpControlV2StateActions.setActivatedIdentity({
            terminalId: 'terminal-root-002',
            activatedAt: Date.now(),
        }))
        await harness.runtime.dispatchCommand(createCommand(
            runtimeShellV2CommandDefinitions.initialize,
            {},
        ))

        const tree = renderWithStore(
            <RootScreen deviceId="DEVICE-001" />,
            harness.store,
            harness.runtime,
        )

        const host = tree.root.findByProps({testID: 'ui-integration-retail-shell:root'})
        for (let index = 0; index < 5; index += 1) {
            await act(async () => {
                const event = {
                    nativeEvent: {
                        pageX: 12,
                        pageY: 12,
                    },
                }
                host.props.onClick?.(event)
                host.props.onTouchEnd?.(event)
            })
        }

        expect(() => tree.root.findByProps({testID: 'ui-base-admin-popup:login'})).not.toThrow()
    })
})
