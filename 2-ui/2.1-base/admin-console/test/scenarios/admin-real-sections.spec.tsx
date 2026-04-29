import React, {useState} from 'react'
import {act} from 'react-test-renderer'
import {describe, expect, it, vi} from 'vitest'
import {Pressable, Text} from 'react-native'
import {createCommand} from '@next/kernel-base-runtime-shell-v2'
import {
    createTcpControlRuntimeModuleV2,
    tcpControlV2CommandDefinitions,
    tcpControlV2StateActions,
} from '@next/kernel-base-tcp-control-runtime-v2'
import {
    createTdpSyncRuntimeModuleV2,
    tdpHotUpdateActions,
    tdpSyncV2StateActions,
} from '@next/kernel-base-tdp-sync-runtime-v2'
import {createAppError} from '@next/kernel-base-contracts'
import {
    topologyRuntimeV3CommandDefinitions,
    topologyRuntimeV3StateActions,
} from '@next/kernel-base-topology-runtime-v3'
import {
    createWorkflowRuntimeModuleV2,
} from '@next/kernel-base-workflow-runtime-v2'
import {
    AdapterDiagnosticsScreen,
    AdminTerminalSection,
    AdminTdpSection,
    AdminTopologySection,
    AdminVersionSection,
    adminConsoleCommandDefinitions,
    adminConsoleStateActions,
} from '../../src'
import type {
    AdminTdpHost,
    AdminTdpServerOperationsSnapshot,
} from '../../src'
import {
    createAdminConsoleHarness,
    renderWithAutomation,
    renderWithStore,
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

        await expect(topologyTree.getNode('ui-base-admin-section:topology:set-master')).resolves.toMatchObject({
            enabled: false,
            availableActions: [],
        })
        await topologyTree.press('ui-base-admin-section:topology:start')

        expect(dispatchSpy).toHaveBeenCalledWith(createCommand(
            topologyRuntimeV3CommandDefinitions.startTopologyConnection,
            {},
        ))
        expect(dispatchSpy.mock.calls.map(call => call[0]?.definition?.commandName)).not.toContain(
            topologyRuntimeV3CommandDefinitions.setInstanceMode.commandName,
        )
    })

    it('derives topology pairing button availability from current topology state', async () => {
        const harness = await createAdminConsoleHarness()
        const topologyTree = renderWithAutomation(
            <AdminTopologySection runtime={harness.runtime} store={harness.store} />,
            harness.store,
            harness.runtime,
        )

        await expect(topologyTree.getNode('ui-base-admin-section:topology:set-master')).resolves.toMatchObject({
            enabled: false,
        })
        await expect(topologyTree.getNode('ui-base-admin-section:topology:disable-slave')).resolves.toMatchObject({
            enabled: false,
        })
        await expect(topologyTree.getNode('ui-base-admin-section:topology:stop')).resolves.toMatchObject({
            enabled: false,
        })
        await expect(topologyTree.getNode('ui-base-admin-section:topology:restart')).resolves.toMatchObject({
            enabled: false,
        })
        await expect(topologyTree.getNode('ui-base-admin-section:topology:clear-master')).resolves.toMatchObject({
            enabled: false,
        })

        await topologyTree.dispatch(() => {
            harness.store.dispatch(topologyRuntimeV3StateActions.patchConfigState({
                enableSlave: true,
                masterLocator: {
                    masterDeviceId: 'MASTER-001',
                    serverAddress: [{address: 'ws://127.0.0.1:5810/ws'}],
                    addedAt: Date.now() as any,
                },
            }))
            harness.store.dispatch(topologyRuntimeV3StateActions.patchConnectionState({
                serverConnectionStatus: 'CONNECTED',
            }))
        })

        await expect(topologyTree.getNode('ui-base-admin-section:topology:enable-slave')).resolves.toMatchObject({
            enabled: false,
        })
        await expect(topologyTree.getNode('ui-base-admin-section:topology:disable-slave')).resolves.toMatchObject({
            enabled: true,
            availableActions: ['press'],
        })
        await expect(topologyTree.getNode('ui-base-admin-section:topology:start')).resolves.toMatchObject({
            enabled: false,
        })
        await expect(topologyTree.getNode('ui-base-admin-section:topology:stop')).resolves.toMatchObject({
            enabled: true,
        })
        await expect(topologyTree.getNode('ui-base-admin-section:topology:restart')).resolves.toMatchObject({
            enabled: true,
        })
        await expect(topologyTree.getNode('ui-base-admin-section:topology:clear-master')).resolves.toMatchObject({
            enabled: true,
        })
    })

    it('dispatches admin clear-master command instead of mixing host/runtime calls inline', async () => {
        const clearMasterLocator = vi.fn(async () => {})
        const harness = await createAdminConsoleHarness({
            hostTools: {
                topology: {
                    clearMasterLocator,
                },
            } as any,
        })
        const dispatchSpy = vi.spyOn(harness.runtime, 'dispatchCommand')
        const topologyTree = renderWithAutomation(
            <AdminTopologySection
                runtime={harness.runtime}
                store={harness.store}
                host={{
                    clearMasterLocator,
                } as any}
            />,
            harness.store,
            harness.runtime,
        )

        await topologyTree.dispatch(() => {
            harness.store.dispatch(topologyRuntimeV3StateActions.patchConfigState({
                masterLocator: {
                    masterDeviceId: 'MASTER-001',
                    serverAddress: [{address: 'ws://127.0.0.1:5810/ws'}],
                    addedAt: Date.now() as any,
                },
            }))
        })
        await topologyTree.press('ui-base-admin-section:topology:clear-master')

        expect(dispatchSpy).toHaveBeenCalledWith(createCommand(
            adminConsoleCommandDefinitions.clearTopologyMasterLocator,
            {},
        ))
        expect(dispatchSpy.mock.calls.map(call => call[0]?.definition?.commandName)).not.toContain(
            topologyRuntimeV3CommandDefinitions.clearMasterLocator.commandName,
        )
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
        const dispatchSpy = vi.spyOn(harness.runtime, 'dispatchCommand')
        const topologyTree = renderWithAutomation(
            <AdminTopologySection
                runtime={harness.runtime}
                store={harness.store}
                host={{
                    reconnect,
                } as any}
            />,
            harness.store,
            harness.runtime,
        )

        await topologyTree.press('ui-base-admin-section:topology:reconnect')

        expect(dispatchSpy.mock.calls.map(call => call[0]?.definition?.commandName)).toContain(
            adminConsoleCommandDefinitions.reconnectTopologyHost.commandName,
        )
        expect(reconnect).toHaveBeenCalledTimes(1)
    })

    it('dispatches admin topology scan command without calling workflow task directly from UI', async () => {
        const stop = vi.fn(async () => {})
        const harness = await createAdminConsoleHarness({
            hostTools: {
                topology: {
                    importSharePayload: vi.fn(async () => {}),
                    stop,
                },
            } as any,
        })
        const dispatchSpy = vi.spyOn(harness.runtime, 'dispatchCommand')
            .mockResolvedValue({
                status: 'COMPLETED',
                requestId: 'request-admin-scan',
                actorResults: [{
                    result: {
                        sharePayload: {
                            formatVersion: '2026.04',
                            deviceId: 'MASTER-001',
                            masterNodeId: 'NODE-001',
                            wsUrl: 'ws://127.0.0.1:18586/ws',
                        },
                    },
                }],
            } as any)
        const renderer = renderWithStore(
            <AdminTopologySection
                runtime={harness.runtime}
                store={harness.store}
                host={{
                    importSharePayload: vi.fn(async () => {}),
                    stop,
                } as any}
            />,
            harness.store,
            harness.runtime,
        )
        await act(async () => {
            harness.store.dispatch(topologyRuntimeV3StateActions.patchConfigState({
                instanceMode: 'SLAVE',
            }))
        })

        const buttons = renderer.root.findAllByProps({testID: 'ui-base-admin-section:topology:scan-master'})
        const stopButtons = renderer.root.findAllByProps({testID: 'ui-base-admin-section:topology:host-stop'})
        await act(async () => {
            await buttons[0].props.onPress()
            await Promise.resolve()
            await stopButtons[0].props.onPress()
        })

        expect(dispatchSpy).toHaveBeenCalledWith(createCommand(
            adminConsoleCommandDefinitions.scanAndImportTopologyMaster,
            {
                scanMode: 'QR_CODE_MODE',
                timeoutMs: 60_000,
                reconnect: true,
            },
        ))
        expect(dispatchSpy.mock.calls.map(call => call[0]?.definition?.commandName)).not.toContain(
            'kernel.base.workflow-runtime-v2.run-workflow',
        )
        expect(dispatchSpy.mock.calls.map(call => call[0]?.definition?.commandName)).toContain(
            adminConsoleCommandDefinitions.stopTopologyHost.commandName,
        )
        expect(stop).not.toHaveBeenCalled()
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

    it('renders version state from tdp hot update runtime and native markers', async () => {
        const readBootMarker = vi.fn(async () => ({
            releaseId: 'release-admin-001',
            packageId: 'package-admin-001',
            bundleVersion: '1.0.0+ota.8',
        }))
        const readActiveMarker = vi.fn(async () => ({
            releaseId: 'release-active-001',
            packageId: 'package-active-001',
            bundleVersion: '1.0.0+ota.7',
        }))
        const clearBootMarker = vi.fn(async () => {})
        const harness = await createAdminConsoleHarness({
            modules: [
                createTcpControlRuntimeModuleV2(),
                createTdpSyncRuntimeModuleV2(),
            ],
        })
        harness.store.dispatch(tdpHotUpdateActions.reportVersion({
            current: {
                source: 'hot-update',
                appId: 'assembly-android-mixc-catering-rn84',
                assemblyVersion: '1.0.0',
                buildNumber: 8,
                runtimeVersion: 'android-mixc-catering-rn84@1.0',
                bundleVersion: '1.0.0+ota.8',
                packageId: 'package-admin-001',
                releaseId: 'release-admin-001',
                installDir: '/data/user/0/next/hot-updates/package-admin-001',
                appliedAt: 1_776_000_000_000,
            },
            at: 1_776_000_000_000,
        }))
        harness.store.dispatch(tdpHotUpdateActions.markReady({
            releaseId: 'release-admin-002',
            packageId: 'package-admin-002',
            bundleVersion: '1.0.0+ota.9',
            installDir: '/data/user/0/next/hot-updates/package-admin-002',
            entryFile: 'index.android.bundle',
            packageSha256: 'sha-package',
            manifestSha256: 'sha-manifest',
            readyAt: 1_776_000_100_000,
        }))
        const tree = renderWithAutomation(
            <AdminVersionSection
                store={harness.store}
                host={{
                    getSnapshot: async () => ({
                        embeddedRelease: [
                            {key: 'bundleVersion', label: 'Bundle 版本', value: '1.0.0+ota.0'},
                        ],
                        nativeMarkers: {
                            boot: await readBootMarker(),
                            active: await readActiveMarker(),
                            rollback: null,
                        },
                        capabilities: [
                            {key: 'clearBootMarker', label: '清除 Boot Marker', value: '已支持', tone: 'ok'},
                        ],
                    }),
                    clearBootMarker,
                }}
            />,
            harness.store,
            harness.runtime,
        )

        await tree.act(async () => {
            await Promise.resolve()
        })
        await expect(tree.getNode('ui-base-admin-section:version')).resolves.toBeTruthy()
        await expect(tree.waitForText('1.0.0+ota.8')).resolves.toBeTruthy()
        await expect(tree.queryNodesByText('热更新包')).resolves.not.toHaveLength(0)
        await expect(tree.queryNodesByText('package-admin-001')).resolves.not.toHaveLength(0)
        await expect(tree.queryNodesByText('package-admin-002')).resolves.not.toHaveLength(0)
        await expect(tree.queryNodesByTextContains('release-active-001')).resolves.not.toHaveLength(0)
        await expect(tree.getNode('ui-base-admin-section:version:clear-boot-marker')).resolves.toMatchObject({
            enabled: true,
            availableActions: ['press'],
        })

        await tree.press('ui-base-admin-section:version:clear-boot-marker')

        expect(clearBootMarker).toHaveBeenCalledTimes(1)
    })

    it('keeps version marker actions disabled when native host is unavailable', async () => {
        const harness = await createAdminConsoleHarness({
            modules: [
                createTcpControlRuntimeModuleV2(),
                createTdpSyncRuntimeModuleV2(),
            ],
        })
        const tree = renderWithAutomation(
            <AdminVersionSection store={harness.store} />,
            harness.store,
            harness.runtime,
        )

        await expect(tree.getNode('ui-base-admin-section:version:refresh')).resolves.toMatchObject({
            enabled: false,
        })
        await expect(tree.getNode('ui-base-admin-section:version:clear-boot-marker')).resolves.toMatchObject({
            enabled: false,
        })
        await expect(tree.queryNodesByText('当前版本宿主能力未安装。')).resolves.toHaveLength(1)
    })

    it('renders master pairing qr after share payload is generated', async () => {
        const getSharePayload = vi.fn(async () => ({
            formatVersion: '2026.04',
            deviceId: 'MASTER-QR-001',
            masterNodeId: 'NODE-QR-001',
            wsUrl: 'ws://127.0.0.1:18586/ws',
        }))
        const harness = await createAdminConsoleHarness({
            hostTools: {
                topology: {
                    getSharePayload,
                },
            } as any,
        })
        const topologyTree = renderWithAutomation(
            <AdminTopologySection
                runtime={harness.runtime}
                store={harness.store}
                host={{
                    getSharePayload,
                } as any}
            />,
            harness.store,
            harness.runtime,
        )

        await topologyTree.press('ui-base-admin-section:topology:share-payload')

        await expect(topologyTree.queryNodesByText('主机配对二维码')).resolves.toHaveLength(1)
        await expect(topologyTree.queryNodesByText('请使用副机上的“扫码添加主机”完成配对')).resolves.toHaveLength(1)
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

        await tree.pressRepeatedly('ui-base-admin-adapter-diagnostics:run-all', 2)

        expect(run).toHaveBeenCalledTimes(1)
    })

    it('reacts to externally dispatched adapter diagnostic summary updates', async () => {
        const harness = await createAdminConsoleHarness()
        const tree = renderWithAutomation(
            <AdapterDiagnosticsScreen
                runtime={harness.runtime}
                store={harness.store}
                registry={{
                    getScenarios: () => [{
                        adapterKey: 'scanner',
                        scenarioKey: 'scan',
                        title: '扫码外部更新',
                        run: async () => ({
                            status: 'passed',
                            message: 'not-used',
                        }),
                    }],
                    setScenarios: () => {},
                }}
            />,
            harness.store,
            harness.runtime,
        )

        await expect(tree.queryNodesByText('未执行')).resolves.not.toHaveLength(0)

        await tree.dispatch(() => {
            harness.store.dispatch(adminConsoleStateActions.setLatestAdapterSummary({
                runId: 'adapter-summary-external',
                status: 'failed',
                total: 1,
                passed: 0,
                failed: 1,
                skipped: 0,
                startedAt: 1,
                finishedAt: 2,
                durationMs: 1,
                results: [{
                    adapterKey: 'scanner',
                    scenarioKey: 'scan',
                    title: '扫码外部更新',
                    status: 'failed',
                    message: 'scanner failed externally',
                    startedAt: 1,
                    finishedAt: 2,
                    durationMs: 1,
                }],
            }))
        })

        await expect(tree.queryNodesByText('失败')).resolves.not.toHaveLength(0)
        await expect(tree.queryNodesByText('scanner failed externally')).resolves.toHaveLength(1)
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
        const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

        try {
            await tree.press('ui-base-admin-section:terminal:deactivate')
            await tree.press('unmount-terminal-section')
            const errorCountBeforeCompletion = consoleErrorSpy.mock.calls.length
            await tree.dispatch(async () => {
                resolveDispatch?.({status: 'COMPLETED'})
                await Promise.resolve()
            })

            expect(dispatchSpy).toHaveBeenCalledTimes(1)
            expect(consoleErrorSpy.mock.calls.slice(errorCountBeforeCompletion)).toHaveLength(0)
        } finally {
            dispatchSpy.mockRestore()
            consoleErrorSpy.mockRestore()
        }
    })

    it('renders local-only TDP data plane diagnostics', async () => {
        const harness = await createAdminConsoleHarness({
            modules: [
                createTcpControlRuntimeModuleV2(),
                createTdpSyncRuntimeModuleV2(),
            ],
        })
        harness.store.dispatch(tcpControlV2StateActions.setActivatedIdentity({
            terminalId: 'terminal-tdp-admin',
            activatedAt: Date.now(),
        }))
        harness.store.dispatch(tcpControlV2StateActions.setSandbox({
            sandboxId: 'sandbox-tdp-admin',
            updatedAt: Date.now(),
        }))
        harness.store.dispatch(tcpControlV2StateActions.replaceBinding({
            platformId: 'platform-tdp',
            projectId: 'project-tdp',
            brandId: 'brand-tdp',
            tenantId: 'tenant-tdp',
            storeId: 'store-tdp',
            profileId: 'profile-android-pos',
            templateId: 'terminal-template-android-pos-standard',
        }))
        harness.store.dispatch(tdpSyncV2StateActions.setReady({
            sessionId: 'session-tdp-admin',
            nodeId: 'node-tdp-admin',
            nodeState: 'healthy',
            highWatermark: 12,
            syncMode: 'incremental',
            alternativeEndpoints: [],
            connectedAt: 1_700_000_000_000,
            subscription: {
                version: 1,
                mode: 'explicit',
                hash: 'hash-accepted',
                acceptedTopics: ['catalog.item'],
                rejectedTopics: ['price.policy'],
                requiredMissingTopics: ['terminal.group.membership'],
            },
        }))
        harness.store.dispatch(tdpSyncV2StateActions.setRequestedSubscription({
            hash: 'hash-requested',
            topics: ['catalog.item', 'price.policy', 'terminal.group.membership'],
        }))
        harness.store.dispatch(tdpSyncV2StateActions.setLastAppliedCursor(9))
        harness.store.dispatch(tdpSyncV2StateActions.applyProjection({
            topic: 'catalog.item',
            itemKey: 'sku-001',
            operation: 'upsert',
            scopeType: 'STORE',
            scopeId: 'store-tdp',
            revision: 10,
            payload: {name: 'item'},
            occurredAt: '2026-04-29T00:00:00.000Z',
        }))
        harness.store.dispatch(tdpSyncV2StateActions.recordTopicActivity({
            topic: 'catalog.item',
            source: 'snapshot',
            count: 2,
            receivedAt: 60_000,
            appliedAt: 60_000,
        }))
        harness.store.dispatch(tdpSyncV2StateActions.recordTopicActivity({
            topic: 'catalog.item',
            source: 'changes',
            count: 1,
            receivedAt: 120_000,
            appliedAt: 120_000,
        }))
        harness.store.dispatch(tdpSyncV2StateActions.recordTopicActivity({
            topic: 'price.policy',
            source: 'realtime',
            count: 1,
            receivedAt: 120_000,
            appliedAt: 120_000,
        }))

        const tree = renderWithAutomation(
            <AdminTdpSection store={harness.store} />,
            harness.store,
            harness.runtime,
        )

        await expect(tree.getNode('ui-base-admin-section:tdp')).resolves.toBeTruthy()
        await expect(tree.queryNodesByText('存在 required topic 缺失')).resolves.not.toHaveLength(0)
        await expect(tree.queryNodesByText('profile-android-pos')).resolves.toHaveLength(1)
        await expect(tree.queryNodesByText('terminal-template-android-pos-standard')).resolves.toHaveLength(1)
        await tree.press('ui-base-admin-section:tdp:copy-diagnostics')
        await expect(tree.queryNodesByTextContains('诊断摘要已生成')).resolves.not.toHaveLength(0)

        await tree.press('ui-base-admin-section:tdp:subtab:topics')
        await expect(tree.queryNodesByText('catalog.item')).resolves.not.toHaveLength(0)
        await expect(tree.queryNodesByText('price.policy')).resolves.not.toHaveLength(0)
        await expect(tree.queryNodesByText('terminal.group.membership')).resolves.not.toHaveLength(0)
        await expect(tree.queryNodesByTextContains('服务端诊断未连接')).resolves.not.toHaveLength(0)
        await expect(tree.queryNodesByTextContains('activity 3')).resolves.not.toHaveLength(0)
        await tree.press('ui-base-admin-section:tdp:topic-filter:abnormal')
        await expect(tree.queryNodesByText('catalog.item')).resolves.toHaveLength(0)
        await expect(tree.queryNodesByText('price.policy')).resolves.not.toHaveLength(0)

        await tree.press('ui-base-admin-section:tdp:subtab:topicDetails')
        await expect(tree.queryNodesByText('Topic 活动明细')).resolves.not.toHaveLength(0)
        await expect(tree.queryNodesByTextContains('snapshot 0 · changes 0 · realtime 1')).resolves.not.toHaveLength(0)
        await tree.press('ui-base-admin-section:tdp:topic-filter:all')
        await expect(tree.queryNodesByTextContains('snapshot 2 · changes 1 · realtime 0')).resolves.not.toHaveLength(0)

        await tree.press('ui-base-admin-section:tdp:subtab:server')
        await expect(tree.queryNodesByText('serverDiagnostics: unavailable')).resolves.toHaveLength(1)
    })

    it('refreshes server-enhanced TDP operations diagnostics from host', async () => {
        const harness = await createAdminConsoleHarness({
            modules: [
                createTcpControlRuntimeModuleV2(),
                createTdpSyncRuntimeModuleV2(),
            ],
        })
        harness.store.dispatch(tcpControlV2StateActions.setActivatedIdentity({
            terminalId: 'terminal-tdp-admin',
            activatedAt: Date.now(),
        }))
        harness.store.dispatch(tcpControlV2StateActions.setSandbox({
            sandboxId: 'sandbox-tdp-admin',
            updatedAt: Date.now(),
        }))
        harness.store.dispatch(tcpControlV2StateActions.replaceBinding({
            platformId: 'platform-tdp',
            projectId: 'project-tdp',
            brandId: 'brand-tdp',
            tenantId: 'tenant-tdp',
            storeId: 'store-tdp',
            profileId: 'profile-android-pos',
            templateId: 'terminal-template-android-pos-standard',
        }))
        harness.store.dispatch(tdpSyncV2StateActions.setReady({
            sessionId: 'session-tdp-admin',
            nodeId: 'node-tdp-admin',
            nodeState: 'healthy',
            highWatermark: 12,
            syncMode: 'incremental',
            alternativeEndpoints: [],
            connectedAt: 1_700_000_000_000,
            subscription: {
                version: 1,
                mode: 'explicit',
                hash: 'hash-accepted',
                acceptedTopics: ['catalog.item', 'terminal.group.membership'],
                rejectedTopics: ['price.policy'],
                requiredMissingTopics: ['terminal.group.membership'],
            },
        }))
        harness.store.dispatch(tdpSyncV2StateActions.setRequestedSubscription({
            hash: 'hash-requested',
            topics: ['catalog.item', 'price.policy', 'terminal.group.membership'],
        }))

        const serverSnapshot = {
            mode: 'server-enhanced',
            sampledAt: 1_775_000_000_000,
            terminal: {
                terminalId: 'terminal-tdp-admin',
                sandboxId: 'sandbox-tdp-admin',
                profileId: 'profile-android-pos',
                profileCode: 'ANDROID_POS',
                profileName: '安卓 POS 终端',
                templateId: 'terminal-template-android-pos-standard',
                templateCode: 'ANDROID_POS_STANDARD',
                templateName: '安卓 POS 标准模板',
                presenceStatus: 'ONLINE',
                healthStatus: 'HEALTHY',
                currentAppVersion: '1.2.3',
                currentBundleVersion: 'bundle.9',
                currentConfigVersion: 'config.7',
                lastSeenAt: 1_775_000_000_000,
            },
            topicRegistry: {
                total: 2,
                topics: [
                    {key: 'catalog.item', name: '商品档案'},
                    {key: 'price.policy', name: '价格策略'},
                ],
            },
            policy: {
                allowedTopics: ['catalog.item', 'price.policy'],
                policySources: ['profile:ANDROID_POS', 'template:ANDROID_POS_STANDARD'],
            },
            resolvedTopics: {
                availableTopics: ['catalog.item', 'price.policy'],
                resolvedItemCounts: {
                    'catalog.item': 3,
                    'price.policy': 1,
                },
            },
            sessions: {
                total: 1,
                currentSessionId: 'session-tdp-admin',
                onlineSessions: [{sessionId: 'session-tdp-admin'}],
                current: {
                    sessionId: 'session-tdp-admin',
                    status: 'ONLINE',
                    highWatermark: 12,
                    ackLag: 2,
                    applyLag: 3,
                    connectedAt: 1_775_000_000_000,
                    lastHeartbeatAt: 1_775_000_010_000,
                    subscription: {
                        mode: 'explicit',
                        hash: 'hash-accepted',
                        subscribedTopics: ['catalog.item', 'terminal.group.membership'],
                        acceptedTopics: ['catalog.item', 'terminal.group.membership'],
                        rejectedTopics: ['price.policy'],
                        requiredMissingTopics: ['terminal.group.membership'],
                    },
                },
            },
            subscription: {
                requestedTopics: ['catalog.item', 'price.policy', 'terminal.group.membership'],
                acceptedTopics: ['catalog.item', 'terminal.group.membership'],
                rejectedTopics: ['price.policy'],
                requiredMissingTopics: ['terminal.group.membership'],
                acceptedHash: 'hash-accepted',
                serverAvailableTopics: ['catalog.item', 'price.policy'],
            },
            decisionTrace: {
                runtimeFacts: {terminalId: 'terminal-tdp-admin'},
                membershipSnapshot: {storeId: 'store-tdp'},
                topics: [
                    {
                        topicKey: 'catalog.item',
                        itemKey: 'sku-001',
                        candidateCount: 1,
                        winner: {
                            scopeType: 'STORE',
                            scopeKey: 'store-tdp',
                            revision: 12,
                            source: 'projection',
                            policyId: 'policy-store',
                            reason: 'scope-match',
                        },
                    },
                ],
            },
            findings: [
                {
                    key: 'accepted-topic-unavailable:terminal.group.membership',
                    tone: 'warn',
                    title: 'accepted topic 服务端不可给',
                    detail: 'terminal.group.membership 已被 handshake accepted，但当前服务端 registry/resolved topics 未列出。',
                },
            ],
        } satisfies AdminTdpServerOperationsSnapshot
        const getOperationsSnapshot = vi.fn<AdminTdpHost['getOperationsSnapshot']>()
        getOperationsSnapshot
            .mockResolvedValueOnce(serverSnapshot)
            .mockRejectedValueOnce(new Error('server down'))
        const host: AdminTdpHost = {
            getOperationsSnapshot,
        }

        const tree = renderWithAutomation(
            <AdminTdpSection store={harness.store} host={host} />,
            harness.store,
            harness.runtime,
        )

        await tree.press('ui-base-admin-section:tdp:refresh-server')

        expect(host.getOperationsSnapshot).toHaveBeenCalledWith({
            sandboxId: 'sandbox-tdp-admin',
            terminalId: 'terminal-tdp-admin',
        })
        await expect(tree.queryNodesByTextContains('服务端诊断已刷新：')).resolves.not.toHaveLength(0)
        await expect(tree.queryNodesByText('安卓 POS 终端')).resolves.not.toHaveLength(0)
        await expect(tree.queryNodesByText('安卓 POS 标准模板')).resolves.not.toHaveLength(0)

        await tree.press('ui-base-admin-section:tdp:subtab:topics')
        await expect(tree.queryNodesByTextContains('服务端可给')).resolves.not.toHaveLength(0)
        await expect(tree.queryNodesByTextContains('服务端能力：服务端可给')).resolves.not.toHaveLength(0)
        await expect(tree.queryNodesByTextContains('服务端能力：服务端缺失')).resolves.not.toHaveLength(0)

        await tree.press('ui-base-admin-section:tdp:subtab:server')
        await expect(tree.queryNodesByText('server-enhanced')).resolves.not.toHaveLength(0)
        await expect(tree.queryNodesByTextContains('serverDiagnostics: available')).resolves.not.toHaveLength(0)
        await expect(tree.queryNodesByText('profile:ANDROID_POS, template:ANDROID_POS_STANDARD')).resolves.toHaveLength(1)
        await expect(tree.queryNodesByText('accepted topic 服务端不可给')).resolves.not.toHaveLength(0)
        await expect(tree.queryNodesByTextContains('terminal.group.membership 已被 handshake accepted')).resolves.not.toHaveLength(0)

        await tree.press('ui-base-admin-section:tdp:refresh-server')

        expect(host.getOperationsSnapshot).toHaveBeenCalledTimes(2)
        await expect(tree.queryNodesByTextContains('服务端诊断失败：server down；继续展示上次成功快照')).resolves.not.toHaveLength(0)
        await expect(tree.queryNodesByText('安卓 POS 终端')).resolves.not.toHaveLength(0)
        await expect(tree.queryNodesByText('安卓 POS 标准模板')).resolves.not.toHaveLength(0)
        await expect(tree.queryNodesByTextContains('serverDiagnostics: stale')).resolves.not.toHaveLength(0)
        await expect(tree.queryNodesByTextContains('最近刷新失败：server down')).resolves.not.toHaveLength(0)

        await tree.press('ui-base-admin-section:tdp:copy-diagnostics')
        await expect(tree.queryNodesByTextContains('诊断摘要已生成')).resolves.not.toHaveLength(0)
    })

    it('does not reuse a server TDP snapshot after terminal identity changes', async () => {
        const harness = await createAdminConsoleHarness({
            modules: [
                createTcpControlRuntimeModuleV2(),
                createTdpSyncRuntimeModuleV2(),
            ],
        })
        harness.store.dispatch(tcpControlV2StateActions.setActivatedIdentity({
            terminalId: 'terminal-tdp-admin-a',
            activatedAt: Date.now(),
        }))
        harness.store.dispatch(tcpControlV2StateActions.setSandbox({
            sandboxId: 'sandbox-tdp-admin-a',
            updatedAt: Date.now(),
        }))
        harness.store.dispatch(tcpControlV2StateActions.replaceBinding({
            profileId: 'profile-local-a',
            templateId: 'template-local-a',
        }))

        const getOperationsSnapshot = vi.fn<AdminTdpHost['getOperationsSnapshot']>()
            .mockResolvedValue({
                mode: 'server-enhanced',
                sampledAt: 1_775_000_000_000,
                terminal: {
                    terminalId: 'terminal-tdp-admin-a',
                    sandboxId: 'sandbox-tdp-admin-a',
                    profileName: 'A 终端服务端 Profile',
                    templateName: 'A 终端服务端 Template',
                },
                subscription: {
                    serverAvailableTopics: ['catalog.item'],
                },
            })
        const tree = renderWithAutomation(
            <AdminTdpSection
                store={harness.store}
                host={{getOperationsSnapshot}}
            />,
            harness.store,
            harness.runtime,
        )

        await tree.press('ui-base-admin-section:tdp:refresh-server')
        await expect(tree.queryNodesByText('A 终端服务端 Profile')).resolves.toHaveLength(1)

        await tree.dispatch(() => {
            harness.store.dispatch(tcpControlV2StateActions.setActivatedIdentity({
                terminalId: 'terminal-tdp-admin-b',
                activatedAt: Date.now(),
            }))
            harness.store.dispatch(tcpControlV2StateActions.setSandbox({
                sandboxId: 'sandbox-tdp-admin-b',
                updatedAt: Date.now(),
            }))
            harness.store.dispatch(tcpControlV2StateActions.replaceBinding({
                profileId: 'profile-local-b',
                templateId: 'template-local-b',
            }))
        })

        await expect(tree.queryNodesByText('A 终端服务端 Profile')).resolves.toHaveLength(0)
        await expect(tree.queryNodesByText('profile-local-b')).resolves.toHaveLength(1)
        await tree.press('ui-base-admin-section:tdp:subtab:server')
        await expect(tree.queryNodesByText('serverDiagnostics: unavailable')).resolves.toHaveLength(1)
    })
})
