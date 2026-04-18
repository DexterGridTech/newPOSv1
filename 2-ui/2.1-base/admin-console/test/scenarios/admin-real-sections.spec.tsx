import React, {useState} from 'react'
import {describe, expect, it, vi} from 'vitest'
import {act} from 'react-test-renderer'
import {Pressable, Text} from 'react-native'
import {createCommand} from '@impos2/kernel-base-runtime-shell-v2'
import {
    createTcpControlRuntimeModuleV2,
    tcpControlV2CommandDefinitions,
    tcpControlV2StateActions,
} from '@impos2/kernel-base-tcp-control-runtime-v2'
import {createAppError} from '@impos2/kernel-base-contracts'
import {
    topologyRuntimeV2CommandDefinitions,
    topologyRuntimeV2StateActions,
} from '@impos2/kernel-base-topology-runtime-v2'
import {
    AdapterDiagnosticsScreen,
    AdminTerminalSection,
    AdminTopologySection,
} from '../../src'
import {
    createAdminConsoleHarness,
    renderWithAutomation,
} from '../support/adminConsoleHarness'

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

    it('reacts to topology store changes and shows connection metadata', async () => {
        const harness = await createAdminConsoleHarness()
        const topologyTree = renderWithAutomation(
            <AdminTopologySection runtime={harness.runtime} store={harness.store} />,
            harness.store,
            harness.runtime,
        )

        await act(async () => {
            await harness.runtime.dispatchCommand(createCommand(
                topologyRuntimeV2CommandDefinitions.setInstanceMode,
                {instanceMode: 'SLAVE'},
            ))
            await harness.runtime.dispatchCommand(createCommand(
                topologyRuntimeV2CommandDefinitions.setDisplayMode,
                {displayMode: 'PRIMARY'},
            ))
            await harness.runtime.dispatchCommand(createCommand(
                topologyRuntimeV2CommandDefinitions.setEnableSlave,
                {enableSlave: true},
            ))
            await harness.runtime.dispatchCommand(createCommand(
                topologyRuntimeV2CommandDefinitions.setMasterInfo,
                {
                    masterInfo: {
                        deviceId: 'MASTER-001',
                        serverAddress: [{address: 'ws://127.0.0.1:9999'}],
                        addedAt: Date.now() as any,
                    },
                },
            ))
            harness.store.dispatch(topologyRuntimeV2StateActions.patchConnectionState({
                serverConnectionStatus: 'CONNECTED',
                reconnectAttempt: 2,
                connectedAt: Date.now() as any,
            }))
            harness.store.dispatch(topologyRuntimeV2StateActions.patchPeerState({
                peerNodeId: 'peer-admin-test' as any,
                peerDeviceId: 'PEER-DEVICE-001',
            }))
            harness.store.dispatch(topologyRuntimeV2StateActions.patchSyncState({
                continuousSyncActive: true,
                resumeStatus: 'active',
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
        await act(async () => {
            resolveDispatch?.({status: 'COMPLETED'})
            await Promise.resolve()
        })

        expect(dispatchSpy).toHaveBeenCalledTimes(1)
        expect(consoleErrorSpy).not.toHaveBeenCalled()
        dispatchSpy.mockRestore()
        consoleErrorSpy.mockRestore()
    })
})
