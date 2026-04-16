import React from 'react'
import {describe, expect, it, vi} from 'vitest'
import {act} from 'react-test-renderer'
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
    AdminTerminalSection,
    AdminTopologySection,
} from '../../src'
import {
    createAdminConsoleHarness,
    renderWithStore,
} from '../support/adminConsoleHarness'

describe('admin built-in sections', () => {
    it('renders terminal section from tcp-control state', async () => {
        const harness = await createAdminConsoleHarness()
        const tree = renderWithStore(
            <AdminTerminalSection runtime={harness.runtime} store={harness.store} />,
            harness.store,
            harness.runtime,
        )

        expect(() => tree.root.findByProps({testID: 'ui-base-admin-section:terminal'})).not.toThrow()
    })

    it('dispatches terminal deactivation from terminal section when activated', async () => {
        const harness = await createAdminConsoleHarness({
            modules: [createTcpControlRuntimeModuleV2()],
        })
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
        const tree = renderWithStore(
            <AdminTerminalSection runtime={harness.runtime} store={harness.store} />,
            harness.store,
            harness.runtime,
        )

        await act(async () => {
            tree.root.findByProps({testID: 'ui-base-admin-section:terminal:deactivate'}).props.onPress()
        })

        expect(dispatchSpy).toHaveBeenCalledWith(
            createCommand(tcpControlV2CommandDefinitions.deactivateTerminal, {
                reason: 'admin-console',
            }),
        )
        expect(JSON.stringify(tree.toJSON())).toContain('激活时间')
        expect(JSON.stringify(tree.toJSON())).toContain('凭证过期')
        expect(JSON.stringify(tree.toJSON())).toContain('业务绑定')
        expect(JSON.stringify(tree.toJSON())).toContain('platform-admin')
        expect(JSON.stringify(tree.toJSON())).toContain('request-refresh-1')
        expect(JSON.stringify(tree.toJSON())).toContain('refresh failed')
    })

    it('dispatches topology commands from the merged topology section', async () => {
        const harness = await createAdminConsoleHarness()
        const dispatchSpy = vi.spyOn(harness.runtime, 'dispatchCommand')
        const topologyTree = renderWithStore(
            <AdminTopologySection runtime={harness.runtime} store={harness.store} />,
            harness.store,
            harness.runtime,
        )

        await act(async () => {
            topologyTree.root.findByProps({testID: 'ui-base-admin-section:topology:set-master'}).props.onPress()
            topologyTree.root.findByProps({testID: 'ui-base-admin-section:topology:start'}).props.onPress()
        })

        expect(dispatchSpy).toHaveBeenCalledTimes(2)
    })

    it('reacts to topology store changes and shows connection metadata', async () => {
        const harness = await createAdminConsoleHarness()
        const topologyTree = renderWithStore(
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

        const serialized = JSON.stringify(topologyTree.toJSON())
        expect(serialized).toContain('分支工作区')
        expect(serialized).toContain('主屏')
        expect(serialized).toContain('对端节点')
        expect(serialized).toContain('PEER-DEVICE-001')
        expect(serialized).toContain('重连次数')
    })

    it('shows slave secondary display as main workspace to preserve old topology semantics', async () => {
        const harness = await createAdminConsoleHarness({
            displayContext: {
                displayIndex: 1,
                displayCount: 2,
            },
        } as any)
        const topologyTree = renderWithStore(
            <AdminTopologySection runtime={harness.runtime} store={harness.store} />,
            harness.store,
            harness.runtime,
        )

        const serialized = JSON.stringify(topologyTree.toJSON())
        expect(serialized).toContain('副机')
        expect(serialized).toContain('副屏')
        expect(serialized).toContain('主工作区')
    })
})
