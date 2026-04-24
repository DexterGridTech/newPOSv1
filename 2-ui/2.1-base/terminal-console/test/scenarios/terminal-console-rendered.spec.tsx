import React from 'react'
import {describe, expect, it, vi} from 'vitest'
import {createCommand} from '@next/kernel-base-runtime-shell-v2'
import {
    tcpControlV2CommandDefinitions,
    tcpControlV2StateActions,
} from '@next/kernel-base-tcp-control-runtime-v2'
import {
    selectTopologyRuntimeV3Context,
    topologyRuntimeV3CommandDefinitions,
    topologyRuntimeV3StateActions,
} from '@next/kernel-base-topology-runtime-v3'
import {
    ActivateDeviceScreen,
    ActivateDeviceSecondaryScreen,
    TerminalSummaryScreen,
} from '../../src'
import {
    InputRuntimeProvider,
    VirtualKeyboardOverlay,
} from '../../../input-runtime/src'
import {createTerminalConsoleHarness, renderWithAutomation} from '../support/terminalConsoleHarness'

vi.mock('react-native', async () => {
    const ReactModule = await import('react')
    const actual = await vi.importActual<typeof import('react-native')>('react-native')

    return {
        ...actual,
        TextInput: (props: Record<string, unknown>) => ReactModule.createElement('mock-text-input', props),
    }
})

const renderActivationScreen = async (
    input: {
        dispatchCommand?: typeof createTerminalConsoleHarness extends (...args: any[]) => Promise<infer T>
            ? T['runtime']['dispatchCommand']
            : never
        harnessInput?: Parameters<typeof createTerminalConsoleHarness>[0]
    } = {},
) => {
    const harness = await createTerminalConsoleHarness(input.harnessInput)
    const dispatched: unknown[] = []

    if (input.dispatchCommand) {
        vi.spyOn(harness.runtime, 'dispatchCommand').mockImplementation(input.dispatchCommand as any)
    } else {
        vi.spyOn(harness.runtime, 'dispatchCommand').mockImplementation(async command => {
            dispatched.push(command)
            return {status: 'COMPLETED'} as any
        })
    }

    return {
        harness,
        dispatched,
        tree: renderWithAutomation(
            <InputRuntimeProvider>
                <ActivateDeviceScreen />
                <VirtualKeyboardOverlay />
            </InputRuntimeProvider>,
            harness.store,
            harness.runtime,
        ),
    }
}

const typeVirtualValue = async (
    tree: Awaited<ReturnType<typeof renderActivationScreen>>['tree'],
    fieldNodeId: string,
    value: string,
) => {
    await tree.typeVirtualValue(fieldNodeId, value)
    await tree.waitForIdle()
}

describe('terminal-console screens', () => {
    it('renders activation screen with stable call-to-action nodes', async () => {
        const harness = await createTerminalConsoleHarness()
        const tree = renderWithAutomation(<ActivateDeviceScreen />, harness.store, harness.runtime)

        await expect(tree.getNode('ui-base-terminal-activate-device')).resolves.toBeTruthy()
        await expect(tree.getNode('ui-base-terminal-activate-device:title')).resolves.toBeTruthy()
        await expect(tree.getNode('ui-base-terminal-activate-device:sandbox')).resolves.toBeTruthy()
        await expect(tree.getNode('ui-base-terminal-activate-device:sandbox-value')).resolves.toBeTruthy()
        await expect(tree.getNode('ui-base-terminal-activate-device:input')).resolves.toBeTruthy()
        await expect(tree.getNode('ui-base-terminal-activate-device:submit')).resolves.toBeTruthy()
        await expect(tree.getNode('ui-base-terminal-activate-device:identity')).resolves.toBeTruthy()
        await expect(tree.getNode('ui-base-terminal-activate-device:device-id')).resolves.toBeTruthy()
    })

    it('keeps short activation codes local and does not dispatch activation', async () => {
        const {dispatched, tree} = await renderActivationScreen()

        await typeVirtualValue(tree, 'ui-base-terminal-activate-device:sandbox', 'sandbox-test-001')
        await typeVirtualValue(tree, 'ui-base-terminal-activate-device:input', '123')

        await expect(tree.getNode('ui-base-terminal-activate-device:submit')).resolves.toMatchObject({
            enabled: false,
        })
        expect(dispatched).toHaveLength(0)
    })

    it('normalizes virtual input and dispatches terminal activation command', async () => {
        const {dispatched, tree} = await renderActivationScreen()

        await typeVirtualValue(tree, 'ui-base-terminal-activate-device:sandbox', 'SANDBOX-TEST-001')
        await typeVirtualValue(tree, 'ui-base-terminal-activate-device:input', 'ABC123')
        await tree.press('ui-base-terminal-activate-device:submit')
        await tree.waitForIdle()

        await expect(tree.getNode('ui-base-terminal-activate-device:sandbox-value')).resolves.toMatchObject({
            value: 'sandbox-test-001',
        })
        await expect(tree.getNode('ui-base-terminal-activate-device:value')).resolves.toMatchObject({
            value: 'ABC123',
        })
        expect(dispatched).toEqual([
            createCommand(tcpControlV2CommandDefinitions.activateTerminal, {
                sandboxId: 'sandbox-test-001',
                activationCode: 'ABC123',
            }),
        ])
    })

    it('blocks activation form for standalone slave instances', async () => {
        const {dispatched, harness, tree} = await renderActivationScreen()

        await tree.dispatch(() => {
            harness.store.dispatch(topologyRuntimeV3StateActions.replaceContextState({
                ...selectTopologyRuntimeV3Context(harness.store.getState())!,
                displayIndex: 0,
                displayCount: 1,
                instanceMode: 'SLAVE',
                displayMode: 'PRIMARY',
                standalone: true,
            }))
        })
        await typeVirtualValue(tree, 'ui-base-terminal-activate-device:sandbox', 'sandbox-test-001')
        await typeVirtualValue(tree, 'ui-base-terminal-activate-device:input', 'ABC123')
        await tree.waitForIdle()

        await expect(tree.getNode('ui-base-terminal-activate-device:message')).resolves.toMatchObject({
            text: '当前是副机，副机不允许激活，请先切回主机。',
            value: 'slave-instance',
        })
        await expect(tree.getNode('ui-base-terminal-activate-device:submit')).resolves.toMatchObject({
            enabled: false,
        })
        await expect(tree.getNode('ui-base-terminal-activate-device:value')).resolves.toMatchObject({
            value: '',
        })
        expect(dispatched).toHaveLength(0)
    })

    it('blocks activation form for managed secondary displays', async () => {
        const managed = await renderActivationScreen({
            harnessInput: {
                displayContext: {
                    displayIndex: 1,
                    displayCount: 2,
                },
            },
        })
        await managed.tree.dispatch(() => {
            managed.harness.store.dispatch(topologyRuntimeV3StateActions.replaceContextState({
                ...selectTopologyRuntimeV3Context(managed.harness.store.getState())!,
                displayIndex: 1,
                displayCount: 2,
                instanceMode: 'SLAVE',
                displayMode: 'SECONDARY',
                standalone: false,
            }))
        })
        await typeVirtualValue(managed.tree, 'ui-base-terminal-activate-device:sandbox', 'sandbox-test-001')
        await typeVirtualValue(managed.tree, 'ui-base-terminal-activate-device:input', 'ABC123')
        await managed.tree.waitForIdle()

        await expect(managed.tree.getNode('ui-base-terminal-activate-device:message')).resolves.toMatchObject({
            text: '当前是托管副屏，托管副屏不参与激活。',
            value: 'managed-secondary',
        })
        await expect(managed.tree.getNode('ui-base-terminal-activate-device:submit')).resolves.toMatchObject({
            enabled: false,
        })
        expect(managed.dispatched).toHaveLength(0)
    })

    it('renders already activated state instead of dispatching another activation', async () => {
        const {dispatched, harness, tree} = await renderActivationScreen()

        await tree.dispatch(() => {
            harness.store.dispatch(tcpControlV2StateActions.setActivationStatus('ACTIVATED'))
        })
        await typeVirtualValue(tree, 'ui-base-terminal-activate-device:sandbox', 'sandbox-test-001')
        await typeVirtualValue(tree, 'ui-base-terminal-activate-device:input', 'ABC123')
        await tree.waitForIdle()

        await expect(tree.getNode('ui-base-terminal-activate-device:message')).resolves.toMatchObject({
            text: '当前设备已激活，如需改为副机，请先解除激活。',
            value: 'already-activated',
        })
        await expect(tree.getNode('ui-base-terminal-activate-device:submit')).resolves.toMatchObject({
            text: '已激活',
            enabled: false,
        })
        expect(dispatched).toHaveLength(0)
    })

    it('keeps master unactivated activation form submit-capable', async () => {
        const {tree} = await renderActivationScreen()

        await typeVirtualValue(tree, 'ui-base-terminal-activate-device:sandbox', 'sandbox-test-001')
        await typeVirtualValue(tree, 'ui-base-terminal-activate-device:input', 'ABC123')

        await expect(tree.getNode('ui-base-terminal-activate-device:message')).resolves.toMatchObject({
            value: 'master-unactivated',
        })
        await expect(tree.getNode('ui-base-terminal-activate-device:submit')).resolves.toMatchObject({
            enabled: true,
        })
    })

    it('does not dispatch activation when sandboxId is missing', async () => {
        const {dispatched, tree} = await renderActivationScreen()

        await typeVirtualValue(tree, 'ui-base-terminal-activate-device:input', 'ABC123')

        await expect(tree.getNode('ui-base-terminal-activate-device:submit')).resolves.toMatchObject({
            enabled: false,
        })
        expect(dispatched).toHaveLength(0)
    })

    it('renders dispatch errors as activation screen messages', async () => {
        const {tree} = await renderActivationScreen({
            async dispatchCommand() {
                throw new Error('activation-code-invalid')
            },
        })

        await typeVirtualValue(tree, 'ui-base-terminal-activate-device:sandbox', 'sandbox-test-001')
        await typeVirtualValue(tree, 'ui-base-terminal-activate-device:input', 'A1B2C3')
        await tree.press('ui-base-terminal-activate-device:submit')
        await tree.waitForText('activation-code-invalid')

        await expect(tree.getNode('ui-base-terminal-activate-device:message')).resolves.toMatchObject({
            text: 'activation-code-invalid',
        })
        await expect(tree.getNode('ui-base-terminal-activate-device:submit')).resolves.toMatchObject({
            enabled: true,
        })
    })

    it('renders secondary waiting screen with stable terminal context nodes', async () => {
        const harness = await createTerminalConsoleHarness({
            displayContext: {
                displayIndex: 1,
                displayCount: 2,
            },
        })
        const tree = renderWithAutomation(<ActivateDeviceSecondaryScreen />, harness.store, harness.runtime)
        await tree.dispatchCommand(createCommand(
            topologyRuntimeV3CommandDefinitions.setDisplayMode,
            {
                displayMode: 'SECONDARY',
            },
        ))
        await tree.dispatch(() => {
            harness.store.dispatch(tcpControlV2StateActions.setDeviceInfo({
                id: 'DEVICE-SECONDARY-001',
                model: 'Renderer POS Secondary',
            }))
        })
        await expect(tree.getNode('ui-base-terminal-activate-device-secondary')).resolves.toBeTruthy()
        await expect(tree.getNode('ui-base-terminal-activate-device-secondary:device-id')).resolves.toBeTruthy()
        await expect(tree.getNode('ui-base-terminal-activate-device-secondary:display-mode')).resolves.toBeTruthy()
    })

    it('keeps managed secondary device id hidden until topology sync becomes active', async () => {
        const harness = await createTerminalConsoleHarness({
            displayContext: {
                displayIndex: 1,
                displayCount: 2,
            },
        })
        const tree = renderWithAutomation(<ActivateDeviceSecondaryScreen />, harness.store, harness.runtime)
        await tree.dispatchCommand(createCommand(
            topologyRuntimeV3CommandDefinitions.setInstanceMode,
            {
                instanceMode: 'SLAVE',
            },
        ))
        await tree.dispatchCommand(createCommand(
            topologyRuntimeV3CommandDefinitions.setDisplayMode,
            {
                displayMode: 'SECONDARY',
            },
        ))
        await tree.dispatch(() => {
            harness.store.dispatch(topologyRuntimeV3StateActions.replaceContextState({
                ...selectTopologyRuntimeV3Context(harness.store.getState())!,
                standalone: false,
            }))
            harness.store.dispatch(tcpControlV2StateActions.setDeviceInfo({
                id: 'DEVICE-SHOULD-BE-HIDDEN',
                model: 'Renderer POS Secondary',
            }))
        })

        await expect(tree.getNode('ui-base-terminal-activate-device-secondary:device-id')).resolves.toMatchObject({
            text: '等待主屏同步',
            value: '等待主屏同步',
        })

        await tree.dispatch(() => {
            harness.store.dispatch(topologyRuntimeV3StateActions.patchSyncState({
                status: 'active',
                activeSessionId: 'session-terminal-secondary',
            }))
        })

        await expect(tree.getNode('ui-base-terminal-activate-device-secondary:device-id')).resolves.toMatchObject({
            text: 'DEVICE-SHOULD-BE-HIDDEN',
            value: 'DEVICE-SHOULD-BE-HIDDEN',
        })
    })

    it('renders summary screen against the kernel runtime', async () => {
        const harness = await createTerminalConsoleHarness()
        const summary = renderWithAutomation(<TerminalSummaryScreen />, harness.store, harness.runtime)
        await summary.dispatch(() => {
            harness.store.dispatch(tcpControlV2StateActions.setDeviceInfo({
                id: 'DEVICE-RENDER-001',
                model: 'Renderer POS',
            }))
            harness.store.dispatch(tcpControlV2StateActions.setActivatedIdentity({
                terminalId: 'terminal-render-001',
                activatedAt: 1_765_400_000_000 as any,
            }))
            harness.store.dispatch(tcpControlV2StateActions.setCredential({
                accessToken: 'token-render-001',
                refreshToken: 'refresh-render-001',
                expiresAt: 1_765_500_000_000 as any,
                updatedAt: 1_765_450_000_000 as any,
            }))
        })

        await expect(summary.getNode('ui-base-terminal-summary')).resolves.toBeTruthy()
        await expect(summary.getText('ui-base-terminal-summary:description'))
            .resolves.toContain('终端已完成激活')
    })
})
