import React, {useState} from 'react'
import {act} from 'react-test-renderer'
import {describe, expect, it, vi} from 'vitest'
import {Pressable, Text} from 'react-native'
import {createCommand} from '@impos2/kernel-base-runtime-shell-v2'
import {
    createTcpControlRuntimeModuleV2,
    tcpControlV2CommandDefinitions,
    tcpControlV2StateActions,
} from '@impos2/kernel-base-tcp-control-runtime-v2'
import {createAppError} from '@impos2/kernel-base-contracts'
import {
    topologyRuntimeV3CommandDefinitions,
    topologyRuntimeV3StateActions,
} from '@impos2/kernel-base-topology-runtime-v3'
import {
    AdapterDiagnosticsScreen,
    AdminTerminalSection,
    AdminTopologySection,
} from '../../src'
import {
    createAdminConsoleHarness,
    renderWithAutomation,
    renderWithStore,
} from '../support/adminConsoleHarness'
import {InputField} from '../../../input-runtime/src'

describe('admin built-in sections', () => {
    it('renders terminal section from tcp-control state', async () => {
        const harness = await createAdminConsoleHarness()
        const tree = renderWithAutomation(
            <AdminTerminalSection runtime={harness.runtime} store={harness.store} />,
            harness.store,
            harness.runtime,
        )

        await expect(tree.getNode('ui-base-admin-section:terminal')).resolves.toBeTruthy()
    })

    it('dispatches terminal deactivation from terminal section when activated', async () => {
        const harness = await createAdminConsoleHarness({
            modules: [createTcpControlRuntimeModuleV2()],
        })
        const closePanel = vi.fn()
        harness.store.dispatch(tcpControlV2StateActions.setActivatedIdentity({
            terminalId: 'terminal-admin-test',
            activatedAt: Date.now(),
        }))
        harness.store.dispatch(tcpControlV2StateActions.setCredential({
            accessToken: 'token-admin-test',
            refreshToken: 'refresh-admin-test',
            expiresAt: Date.now() + 60_000,
            refreshExpiresAt: Date.now() + 3600_000,
            updatedAt: Date.now(),
        }))
        harness.store.dispatch(tcpControlV2StateActions.setSandbox({
            sandboxId: 'sandbox-admin-test',
            updatedAt: Date.now(),
        }))
        harness.store.dispatch(tcpControlV2StateActions.replaceBinding({
            platformId: 'platform-admin',
            projectId: 'project-admin',
            brandId: 'brand-admin',
            tenantId: 'tenant-admin',
            storeId: 'store-admin',
            templateId: 'template-admin',
        }))
        harness.store.dispatch(tcpControlV2StateActions.setBootstrapped(true))
        harness.store.dispatch(tcpControlV2StateActions.setLastActivationRequestId('request-activate-1'))
        harness.store.dispatch(tcpControlV2StateActions.setLastRefreshRequestId('request-refresh-1'))
        harness.store.dispatch(tcpControlV2StateActions.setLastTaskReportRequestId('request-task-1'))
        harness.store.dispatch(tcpControlV2StateActions.setLastError(createAppError({
            key: 'tcp_control_failed',
            name: 'tcp_control_failed',
            defaultTemplate: 'refresh failed',
            category: 'NETWORK',
            severity: 'MEDIUM',
            code: 'TCP-CONTROL-FAILED',
        } as any, {
            args: {reason: 'network'},
        })))
        const dispatchSpy = vi.spyOn(harness.runtime, 'dispatchCommand')
            .mockResolvedValue({status: 'COMPLETED'} as any)
        const tree = renderWithAutomation(
            <AdminTerminalSection runtime={harness.runtime} store={harness.store} closePanel={closePanel} />,
            harness.store,
            harness.runtime,
        )

        await tree.press('ui-base-admin-section:terminal:deactivate')

        expect(dispatchSpy).toHaveBeenCalledWith(
            createCommand(tcpControlV2CommandDefinitions.deactivateTerminal, {
                reason: 'admin-console',
            }),
        )
        expect(closePanel).toHaveBeenCalledTimes(1)
        await expect(tree.queryNodesByText('激活时间')).resolves.toHaveLength(1)
        await expect(tree.queryNodesByText('sandbox-admin-test')).resolves.toHaveLength(1)
        await expect(tree.queryNodesByText('凭证过期')).resolves.toHaveLength(1)
        await expect(tree.queryNodesByText('业务绑定')).resolves.toHaveLength(1)
        await expect(tree.queryNodesByText('platform-admin')).resolves.toHaveLength(1)
        await expect(tree.queryNodesByText('request-refresh-1')).resolves.toHaveLength(1)
        await expect(tree.queryNodesByText('refresh failed')).resolves.toHaveLength(1)
    })

    it('dispatches topology commands from the merged topology section', async () => {
        const harness = await createAdminConsoleHarness()
        const dispatchSpy = vi.spyOn(harness.runtime, 'dispatchCommand')
        const topologyTree = renderWithAutomation(
            <AdminTopologySection runtime={harness.runtime} store={harness.store} />,
            harness.store,
            harness.runtime,
        )

        await topologyTree.press('ui-base-admin-section:topology:set-master')
        await topologyTree.press('ui-base-admin-section:topology:start')

        expect(dispatchSpy).toHaveBeenCalledTimes(2)
    })

    it('dispatches enable-slave commands and keeps display switching disabled for master primary', async () => {
        const harness = await createAdminConsoleHarness()
        const dispatchSpy = vi.spyOn(harness.runtime, 'dispatchCommand')
        const topologyTree = renderWithAutomation(
            <AdminTopologySection runtime={harness.runtime} store={harness.store} />,
            harness.store,
            harness.runtime,
        )

        await topologyTree.press('ui-base-admin-section:topology:enable-slave')
        await topologyTree.press('ui-base-admin-section:topology:disable-slave')

        await expect(topologyTree.getNode('ui-base-admin-section:topology:set-primary')).resolves.toMatchObject({
            enabled: false,
        })
        await expect(topologyTree.getNode('ui-base-admin-section:topology:set-secondary')).resolves.toMatchObject({
            enabled: false,
        })
        expect(dispatchSpy).toHaveBeenCalledWith(createCommand(
            topologyRuntimeV3CommandDefinitions.setEnableSlave,
            {enableSlave: true},
        ))
        expect(dispatchSpy).toHaveBeenCalledWith(createCommand(
            topologyRuntimeV3CommandDefinitions.setEnableSlave,
            {enableSlave: false},
        ))
    })

    it('calls topology host reconnect action when provided', async () => {
        const reconnect = vi.fn(async () => {})
        const harness = await createAdminConsoleHarness({
            hostTools: {
                topology: {
                    reconnect,
                },
            } as any,
        })
        const topologyTree = renderWithAutomation(
            <AdminTopologySection runtime={harness.runtime} store={harness.store} />,
            harness.store,
            harness.runtime,
        )

        await topologyTree.press('ui-base-admin-section:topology:reconnect')

        expect(reconnect).toHaveBeenCalledTimes(1)
    })

    it('imports topology share payload from pasted json and routes host stop to enableSlave=false', async () => {
        const importSharePayload = vi.fn(async () => {})
        const stop = vi.fn(async () => {})
        const harness = await createAdminConsoleHarness({
            hostTools: {
                topology: {
                    importSharePayload,
                    stop,
                },
            } as any,
        })
        const renderer = renderWithStore(
            <AdminTopologySection runtime={harness.runtime} store={harness.store} />,
            harness.store,
            harness.runtime,
        )
        const input = renderer.root.findByType(InputField)
        await act(async () => {
            input.props.onChangeText('{"formatVersion":"2026.04","deviceId":"MASTER-001","masterNodeId":"NODE-001"}')
        })

        const buttons = renderer.root.findAllByProps({testID: 'ui-base-admin-section:topology:import-json'})
        const stopButtons = renderer.root.findAllByProps({testID: 'ui-base-admin-section:topology:host-stop'})
        await act(async () => {
            buttons[0].props.onPress()
            stopButtons[0].props.onPress()
        })

        expect(importSharePayload).toHaveBeenCalledWith({
            formatVersion: '2026.04',
            deviceId: 'MASTER-001',
            masterNodeId: 'NODE-001',
        })
        expect(stop).toHaveBeenCalledTimes(1)
    })

    it('reacts to topology store changes and shows connection metadata', async () => {
        const harness = await createAdminConsoleHarness()
        const topologyTree = renderWithAutomation(
            <AdminTopologySection runtime={harness.runtime} store={harness.store} />,
            harness.store,
            harness.runtime,
        )

        await topologyTree.dispatchCommand(createCommand(
            topologyRuntimeV3CommandDefinitions.setInstanceMode,
            {instanceMode: 'SLAVE'},
        ))
        await topologyTree.dispatchCommand(createCommand(
            topologyRuntimeV3CommandDefinitions.setDisplayMode,
            {displayMode: 'PRIMARY'},
        ))
        await topologyTree.dispatchCommand(createCommand(
            topologyRuntimeV3CommandDefinitions.setEnableSlave,
            {enableSlave: true},
        ))
        await topologyTree.dispatchCommand(createCommand(
            topologyRuntimeV3CommandDefinitions.setMasterLocator,
            {
                masterLocator: {
                    masterDeviceId: 'MASTER-001',
                    masterNodeId: 'MASTER-NODE-001',
                    serverAddress: [{address: 'ws://127.0.0.1:9999'}],
                    addedAt: Date.now() as any,
                },
            },
        ))
        await topologyTree.dispatch(() => {
            harness.store.dispatch(topologyRuntimeV3StateActions.patchConnectionState({
                serverConnectionStatus: 'CONNECTED',
                reconnectAttempt: 2,
            }))
            harness.store.dispatch(topologyRuntimeV3StateActions.patchPeerState({
                peerNodeId: 'peer-admin-test' as any,
                peerDeviceId: 'PEER-DEVICE-001',
                connectedAt: Date.now() as any,
            }))
            harness.store.dispatch(topologyRuntimeV3StateActions.patchSyncState({
                status: 'active',
                activeSessionId: 'session-admin-001',
            }))
        })

        await expect(topologyTree.queryNodesByText('分支工作区')).resolves.toHaveLength(1)
        await expect(topologyTree.queryNodesByText('主屏')).resolves.toHaveLength(1)
        await expect(topologyTree.queryNodesByText('对端节点')).resolves.toHaveLength(1)
        await expect(topologyTree.queryNodesByText('PEER-DEVICE-001')).resolves.toHaveLength(1)
        await expect(topologyTree.queryNodesByText('重连次数')).resolves.toHaveLength(1)
    })

    it('shows slave secondary display as main workspace to preserve old topology semantics', async () => {
        const harness = await createAdminConsoleHarness({
            displayContext: {
                displayIndex: 1,
                displayCount: 2,
            },
        } as any)
        const topologyTree = renderWithAutomation(
            <AdminTopologySection runtime={harness.runtime} store={harness.store} />,
            harness.store,
            harness.runtime,
        )

        await expect(topologyTree.queryNodesByText('副机')).resolves.toHaveLength(1)
        await expect(topologyTree.queryNodesByText('副屏')).resolves.toHaveLength(1)
        await expect(topologyTree.queryNodesByText('主工作区')).resolves.toHaveLength(1)
    })

    it('runs adapter diagnostics only once under rapid double invocation', async () => {
        const harness = await createAdminConsoleHarness()
        const run = vi.fn(async () => {
            await Promise.resolve()
            return {
                status: 'passed' as const,
                message: 'ok',
            }
        })
        const tree = renderWithAutomation(
            <AdapterDiagnosticsScreen
                runtime={harness.runtime}
                store={harness.store}
                registry={{
                    getScenarios: () => [{
                        adapterKey: 'scanner',
                        scenarioKey: 'connect',
                        title: '扫码连接',
                        run,
                    }],
                    setScenarios: () => {},
                }}
            />,
            harness.store,
            harness.runtime,
        )

        await Promise.allSettled([
            tree.press('ui-base-admin-adapter-diagnostics:run-all'),
            tree.press('ui-base-admin-adapter-diagnostics:run-all'),
        ])

        expect(run).toHaveBeenCalledTimes(1)
    })

    it('ignores async terminal deactivation completion after section unmount', async () => {
        const harness = await createAdminConsoleHarness({
            modules: [createTcpControlRuntimeModuleV2()],
        })
        harness.store.dispatch(tcpControlV2StateActions.setActivatedIdentity({
            terminalId: 'terminal-unmount-test',
            activatedAt: Date.now(),
        }))
        let resolveDispatch: ((value: any) => void) | undefined
        const dispatchSpy = vi.spyOn(harness.runtime, 'dispatchCommand')
            .mockImplementation(() => new Promise(resolve => {
                resolveDispatch = resolve
            }) as any)
        const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

        const SectionHarness: React.FC = () => {
            const [mounted, setMounted] = useState(true)
            return mounted ? (
                <>
                    <AdminTerminalSection runtime={harness.runtime} store={harness.store} />
                    <Pressable testID="unmount-terminal-section" onPress={() => setMounted(false)}>
                        <Text>Unmount</Text>
                    </Pressable>
                </>
            ) : null
        }

        const tree = renderWithAutomation(
            <SectionHarness />,
            harness.store,
            harness.runtime,
        )

        await tree.press('ui-base-admin-section:terminal:deactivate')
        await tree.press('unmount-terminal-section')
        await tree.dispatch(async () => {
            resolveDispatch?.({status: 'COMPLETED'})
            await Promise.resolve()
        })

        expect(dispatchSpy).toHaveBeenCalledTimes(1)
        expect(consoleErrorSpy).not.toHaveBeenCalled()
        dispatchSpy.mockRestore()
        consoleErrorSpy.mockRestore()
    })
})
