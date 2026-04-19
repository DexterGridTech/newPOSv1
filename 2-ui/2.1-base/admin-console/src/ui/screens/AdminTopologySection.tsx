import React, {useEffect, useState} from 'react'
import {Text, View} from 'react-native'
import type {EnhancedStore} from '@reduxjs/toolkit'
import {createCommand, type KernelRuntimeV2} from '@impos2/kernel-base-runtime-shell-v2'
import {InputField} from '@impos2/ui-base-input-runtime'
import {
    selectTopologyRuntimeV3Connection,
    selectTopologyRuntimeV3Context,
    selectTopologyRuntimeV3DisplayMode,
    selectTopologyRuntimeV3DisplayModeEligibility,
    selectTopologyRuntimeV3EnableSlave,
    selectTopologyRuntimeV3EnableSlaveEligibility,
    selectTopologyRuntimeV3InstanceMode,
    selectTopologyRuntimeV3MasterLocator,
    selectTopologyRuntimeV3Peer,
    selectTopologyRuntimeV3Sync,
    selectTopologyRuntimeV3SwitchToSlaveEligibility,
    selectTopologyRuntimeV3TcpActivationEligibility,
    selectTopologyRuntimeV3Workspace,
    topologyRuntimeV3CommandDefinitions,
} from '@impos2/kernel-base-topology-runtime-v3'
import {
    selectTcpIdentitySnapshot,
} from '@impos2/kernel-base-tcp-control-runtime-v2'
import {formatAdminStatus, formatAdminTimestamp} from '../../supports/adminFormatting'
import {getAdminHostTools} from '../../supports/adminHostToolsRegistry'
import {
    AdminActionGroup,
    AdminActionButton,
    AdminBlock,
    AdminSectionMessage,
    AdminSectionShell,
    AdminSummaryCard,
    AdminSummaryGrid,
} from './AdminSectionPrimitives'
import type {AdminTopologySharePayload} from '../../types'

export interface AdminTopologySectionProps {
    runtime: KernelRuntimeV2
    store: EnhancedStore
}

export const AdminTopologySection: React.FC<AdminTopologySectionProps> = ({
    runtime,
    store,
}) => {
    const topologyHost = getAdminHostTools().topology
    const reasonMessages: Record<string, string> = {
        'managed-secondary': '当前是托管副屏，不能手工切换拓扑角色或显示模式。',
        'slave-instance': '当前是副机，不能开启副机接入服务，也不能执行 TCP 激活。',
        'activated-master-cannot-switch-to-slave': '当前主机已激活，必须先解除 TCP 激活，才能切换为副机。',
        'already-activated': '当前设备已激活，激活页不会再次提交激活。',
        'master-unactivated': '当前是未激活主机，可以执行主机激活或切换为副机。',
        'master-primary-enable-slave': '只有主机主屏可以开启副机接入服务。',
        'standalone-slave-only-display-mode': '只有独立副机可以手工切换主屏/副屏显示模式。',
    }
    const readSnapshot = () => {
        const state = store.getState()
        const activationStatus = selectTcpIdentitySnapshot(state).activationStatus
        return {
            context: selectTopologyRuntimeV3Context(state),
            instanceMode: selectTopologyRuntimeV3InstanceMode(state) ?? 'UNKNOWN',
            displayMode: selectTopologyRuntimeV3DisplayMode(state) ?? 'UNKNOWN',
            workspace: selectTopologyRuntimeV3Workspace(state) ?? 'UNKNOWN',
            localNodeId: selectTopologyRuntimeV3Context(state)?.localNodeId,
            enableSlave: selectTopologyRuntimeV3EnableSlave(state) ?? false,
            masterLocator: selectTopologyRuntimeV3MasterLocator(state),
            connection: selectTopologyRuntimeV3Connection(state),
            peer: selectTopologyRuntimeV3Peer(state),
            sync: selectTopologyRuntimeV3Sync(state),
            activationStatus,
            tcpActivationEligibility: selectTopologyRuntimeV3TcpActivationEligibility(state, activationStatus as 'UNACTIVATED' | 'ACTIVATED'),
            switchToSlaveEligibility: selectTopologyRuntimeV3SwitchToSlaveEligibility(state, activationStatus as 'UNACTIVATED' | 'ACTIVATED'),
            enableSlaveEligibility: selectTopologyRuntimeV3EnableSlaveEligibility(state),
            displayModeEligibility: selectTopologyRuntimeV3DisplayModeEligibility(state),
        }
    }
    const [snapshot, setSnapshot] = useState(readSnapshot)
    const [hostStatus, setHostStatus] = useState<Record<string, unknown> | null>(null)
    const [hostDiagnostics, setHostDiagnostics] = useState<Record<string, unknown> | null>(null)
    const [sharePayload, setSharePayload] = useState<AdminTopologySharePayload | null>(null)
    const [sharePayloadJson, setSharePayloadJson] = useState('')
    const [message, setMessage] = useState<string | undefined>()
    const {
        context,
        instanceMode,
        displayMode,
        workspace,
        localNodeId,
        enableSlave,
        masterLocator,
        connection,
        peer,
        sync,
        activationStatus,
        tcpActivationEligibility,
        switchToSlaveEligibility,
        enableSlaveEligibility,
        displayModeEligibility,
    } = snapshot
    const hostRunning = (hostStatus?.running === true)
        || hostStatus?.status === 'RUNNING'
        || hostStatus?.serverState === 'RUNNING'
    const hostAddressInfo = hostStatus?.addressInfo && typeof hostStatus.addressInfo === 'object'
        ? hostStatus.addressInfo as Record<string, unknown>
        : {}
    const hostWsUrl = typeof hostAddressInfo.wsUrl === 'string' ? hostAddressInfo.wsUrl : undefined
    const hostHttpBaseUrl = typeof hostAddressInfo.httpBaseUrl === 'string' ? hostAddressInfo.httpBaseUrl : undefined
    const primaryReasonCode = !tcpActivationEligibility.allowed
        ? tcpActivationEligibility.reasonCode
        : !switchToSlaveEligibility.allowed
            ? switchToSlaveEligibility.reasonCode
            : !enableSlaveEligibility.allowed
                ? enableSlaveEligibility.reasonCode
                : !displayModeEligibility.allowed
                    ? displayModeEligibility.reasonCode
                    : tcpActivationEligibility.reasonCode

    const refreshHostStatus = async () => {
        const [nextStatus, nextDiagnostics] = await Promise.all([
            topologyHost?.getTopologyHostStatus?.() ?? Promise.resolve(null),
            topologyHost?.getTopologyHostDiagnostics?.() ?? Promise.resolve(null),
        ])
        setHostStatus(nextStatus)
        setHostDiagnostics(nextDiagnostics)
    }

    const runHostAction = async (
        action: () => Promise<void> | void,
        successMessage: string,
    ) => {
        try {
            await action()
            setMessage(successMessage)
            await refreshHostStatus()
        } catch (error) {
            setMessage(error instanceof Error ? error.message : '拓扑操作失败')
        }
    }

    const importSharePayloadJson = async () => {
        if (!topologyHost?.importSharePayload) {
            throw new Error('当前宿主不支持导入 topology 分享信息')
        }
        const parsed = JSON.parse(sharePayloadJson) as Record<string, unknown>
        const readString = (...keys: string[]): string | undefined => {
            for (const key of keys) {
                const value = parsed[key]
                if (typeof value === 'string') {
                    return value
                }
            }
            return undefined
        }
        const readNumber = (...keys: string[]): number | undefined => {
            for (const key of keys) {
                const value = parsed[key]
                if (typeof value === 'number') {
                    return value
                }
            }
            return undefined
        }
        const readServerAddress = (...keys: string[]): readonly {address: string}[] | undefined => {
            for (const key of keys) {
                const value = parsed[key]
                if (
                    Array.isArray(value)
                    && value.every(item => item && typeof item === 'object' && typeof (item as {address?: unknown}).address === 'string')
                ) {
                    return value as readonly {address: string}[]
                }
            }
            return undefined
        }
        const normalized = {
            formatVersion: readString('formatVersion', 'FORMATVERSION'),
            deviceId: readString('deviceId', 'DEVICEID'),
            masterNodeId: readString('masterNodeId', 'MASTERNODEID'),
            exportedAt: readNumber('exportedAt', 'EXPORTEDAT'),
            wsUrl: readString('wsUrl', 'WSURL'),
            httpBaseUrl: readString('httpBaseUrl', 'HTTPBASEURL'),
            serverAddress: readServerAddress('serverAddress', 'SERVERADDRESS'),
        } satisfies Partial<AdminTopologySharePayload>
        if (
            normalized.formatVersion !== '2026.04'
            || typeof normalized.deviceId !== 'string'
            || typeof normalized.masterNodeId !== 'string'
        ) {
            throw new Error('分享 JSON 格式不正确')
        }
        await topologyHost.importSharePayload(normalized as AdminTopologySharePayload)
        setSharePayload(normalized as AdminTopologySharePayload)
    }

    useEffect(() => {
        const updateSnapshot = () => setSnapshot(readSnapshot())
        updateSnapshot()
        return store.subscribe(updateSnapshot)
    }, [store])

    useEffect(() => {
        void refreshHostStatus()
    }, [topologyHost])

    return (
        <AdminSectionShell
            testID="ui-base-admin-section:topology"
            title="实例与拓扑"
            description="按 V3 一主一副规则控制角色、配对、显示模式和主机服务。"
        >
            <AdminSectionMessage message={message} />
            <AdminSummaryGrid>
                <AdminSummaryCard
                    label="实例模式"
                    value={formatAdminStatus(instanceMode)}
                    detail="当前终端在拓扑中扮演的角色。"
                    tone={instanceMode === 'MASTER' ? 'ok' : 'primary'}
                />
                <AdminSummaryCard
                    label="显示模式"
                    value={formatAdminStatus(displayMode)}
                    detail="当前实例对应主屏或副屏。"
                    tone={displayMode === 'PRIMARY' ? 'primary' : 'neutral'}
                />
                <AdminSummaryCard
                    label="激活状态"
                    value={formatAdminStatus(activationStatus)}
                    detail={reasonMessages[tcpActivationEligibility.reasonCode] ?? tcpActivationEligibility.reasonCode}
                    tone={activationStatus === 'ACTIVATED' ? 'ok' : 'warn'}
                />
                <AdminSummaryCard
                    label="工作区"
                    value={formatAdminStatus(workspace)}
                    detail="拓扑为状态同步计算出的工作区。"
                    tone={workspace !== 'UNKNOWN' ? 'primary' : 'neutral'}
                />
                <AdminSummaryCard
                    label="副机能力"
                    value={enableSlave ? '已启用' : '未启用'}
                    detail="主机是否允许副机接入。"
                    tone={enableSlave ? 'ok' : 'warn'}
                />
                <AdminSummaryCard
                    label="连接状态"
                    value={formatAdminStatus(connection?.serverConnectionStatus)}
                    detail="当前拓扑会话的连接状态。"
                    tone={connection?.serverConnectionStatus === 'CONNECTED' ? 'ok' : 'warn'}
                />
                <AdminSummaryCard
                    label="本机节点"
                    value={localNodeId ?? '未初始化'}
                    detail="当前 runtime 的拓扑节点 ID。"
                    tone={localNodeId ? 'primary' : 'warn'}
                />
                <AdminSummaryCard
                    label="当前限制"
                    value={formatAdminStatus(primaryReasonCode)}
                    detail={reasonMessages[primaryReasonCode] ?? primaryReasonCode}
                    tone={primaryReasonCode === 'master-unactivated' ? 'ok' : 'warn'}
                />
            </AdminSummaryGrid>
            <AdminBlock
                title="主机服务"
                description="主屏主机开启 enableSlave 后由 assembly 启停 native topology host。"
            >
                <AdminSummaryGrid>
                    <AdminSummaryCard
                        label="Host 状态"
                        value={hostRunning ? '运行中' : formatAdminStatus(String(hostStatus?.status ?? 'STOPPED'))}
                        detail={hostWsUrl ?? hostHttpBaseUrl ?? '暂无监听地址'}
                        tone={hostRunning ? 'ok' : 'warn'}
                    />
                    <AdminSummaryCard
                        label="Host HTTP"
                        value={hostHttpBaseUrl ?? '未提供'}
                        detail="用于二维码或 JSON 分享。"
                        tone={hostHttpBaseUrl ? 'primary' : 'neutral'}
                    />
                    <AdminSummaryCard
                        label="Host WS"
                        value={hostWsUrl ?? '未提供'}
                        detail="副机导入后用于持续配对连接。"
                        tone={hostWsUrl ? 'primary' : 'neutral'}
                    />
                    <AdminSummaryCard
                        label="主机设备"
                        value={masterLocator?.masterDeviceId ?? '未配置'}
                        detail="当前已保存的主机设备 ID。"
                        tone={masterLocator?.masterDeviceId ? 'primary' : 'neutral'}
                    />
                    <AdminSummaryCard
                        label="保存时间"
                        value={formatAdminTimestamp(masterLocator?.addedAt)}
                        detail="主机信息写入本机恢复状态的时间。"
                        tone={masterLocator?.addedAt ? 'primary' : 'neutral'}
                    />
                    <AdminSummaryCard
                        label="主机地址"
                        value={masterLocator?.serverAddress?.[0]?.address ?? '未配置'}
                        detail="当前优先生效的主机连接地址。"
                        tone={masterLocator?.serverAddress?.[0]?.address ? 'primary' : 'neutral'}
                    />
                    <AdminSummaryCard
                        label="同步会话"
                        value={sync?.activeSessionId ?? '无'}
                        detail="当前活动中的 topology 会话 ID。"
                        tone={sync?.activeSessionId ? 'ok' : 'neutral'}
                    />
                </AdminSummaryGrid>
            </AdminBlock>
            <AdminBlock
                title="连接与同步"
                description="展示拓扑连接时间、对端节点和连续同步状态。"
            >
                <AdminSummaryGrid>
                    <AdminSummaryCard
                        label="连接时间"
                        value={formatAdminTimestamp(peer?.connectedAt)}
                        detail="最近一次拓扑连接建立时间。"
                        tone={peer?.connectedAt ? 'ok' : 'neutral'}
                    />
                    <AdminSummaryCard
                        label="断开时间"
                        value={formatAdminTimestamp(peer?.disconnectedAt)}
                        detail="最近一次拓扑连接断开时间。"
                        tone={peer?.disconnectedAt ? 'warn' : 'neutral'}
                    />
                    <AdminSummaryCard
                        label="重连次数"
                        value={`${connection?.reconnectAttempt ?? 0}`}
                        detail="当前连接周期内累计重连尝试次数。"
                        tone={(connection?.reconnectAttempt ?? 0) > 0 ? 'warn' : 'neutral'}
                    />
                    <AdminSummaryCard
                        label="对端节点"
                        value={peer?.peerNodeId ?? '未连接'}
                        detail={peer?.peerDeviceId ?? '尚未识别对端设备。'}
                        tone={peer?.peerNodeId ? 'ok' : 'neutral'}
                    />
                    <AdminSummaryCard
                        label="同步状态"
                        value={formatAdminStatus(sync?.status)}
                        detail={`session: ${sync?.activeSessionId ?? 'none'}`}
                        tone={sync?.status === 'active' ? 'ok' : 'neutral'}
                    />
                    <AdminSummaryCard
                        label="上下文更新时间"
                        value={context?.standalone ? '独立主屏' : '受管屏幕'}
                        detail="standalone 由 displayIndex 推导，不持久化。"
                        tone={context?.standalone ? 'primary' : 'neutral'}
                    />
                </AdminSummaryGrid>
            </AdminBlock>
            <AdminBlock
                title="配对控制"
                description="导出/导入配对信息、清空 locator、启动/重连/断开 topology 连接。"
            >
                <AdminActionGroup>
                    <AdminActionButton
                        testID="ui-base-admin-section:topology:set-master"
                        label="切换为主机"
                        onPress={() => void runtime.dispatchCommand(createCommand(
                            topologyRuntimeV3CommandDefinitions.setInstanceMode,
                            {instanceMode: 'MASTER'},
                        ))}
                    />
                    <AdminActionButton
                        testID="ui-base-admin-section:topology:set-slave"
                        label="切换为副机"
                        disabled={!switchToSlaveEligibility.allowed}
                        onPress={() => void runtime.dispatchCommand(createCommand(
                            topologyRuntimeV3CommandDefinitions.setInstanceMode,
                            {instanceMode: 'SLAVE'},
                        ))}
                    />
                    <AdminActionButton
                        testID="ui-base-admin-section:topology:enable-slave"
                        label="启用副机"
                        disabled={!enableSlaveEligibility.allowed}
                        onPress={() => void runtime.dispatchCommand(createCommand(
                            topologyRuntimeV3CommandDefinitions.setEnableSlave,
                            {enableSlave: true},
                        ))}
                    />
                    <AdminActionButton
                        testID="ui-base-admin-section:topology:disable-slave"
                        label="停用副机"
                        disabled={!enableSlaveEligibility.allowed}
                        onPress={() => void runtime.dispatchCommand(createCommand(
                            topologyRuntimeV3CommandDefinitions.setEnableSlave,
                            {enableSlave: false},
                        ))}
                    />
                    <AdminActionButton
                        testID="ui-base-admin-section:topology:start"
                        label="启动连接"
                        tone="primary"
                        onPress={() => void runtime.dispatchCommand(createCommand(
                            topologyRuntimeV3CommandDefinitions.startTopologyConnection,
                            {},
                        ))}
                    />
                    <AdminActionButton
                        testID="ui-base-admin-section:topology:restart"
                        label="重启连接"
                        onPress={() => void runtime.dispatchCommand(createCommand(
                            topologyRuntimeV3CommandDefinitions.restartTopologyConnection,
                            {},
                        ))}
                    />
                    <AdminActionButton
                        testID="ui-base-admin-section:topology:stop"
                        label="断开连接"
                        onPress={() => void runtime.dispatchCommand(createCommand(
                            topologyRuntimeV3CommandDefinitions.stopTopologyConnection,
                            {},
                        ))}
                    />
                    <AdminActionButton
                        testID="ui-base-admin-section:topology:clear-master"
                        label="清空主机"
                        tone="danger"
                        onPress={() => {
                            void topologyHost?.clearMasterLocator?.()
                            void runtime.dispatchCommand(createCommand(
                                topologyRuntimeV3CommandDefinitions.clearMasterLocator,
                                {},
                            ))
                        }}
                    />
                    {topologyHost?.reconnect ? (
                        <AdminActionButton
                            testID="ui-base-admin-section:topology:reconnect"
                            label="重新连接"
                            tone="primary"
                            onPress={() => void runHostAction(
                                () => topologyHost.reconnect?.(),
                                '已请求 host 重新连接',
                            )}
                        />
                    ) : null}
                    {topologyHost?.stop ? (
                        <AdminActionButton
                            testID="ui-base-admin-section:topology:host-stop"
                            label="停止Host"
                            tone="danger"
                            onPress={() => void runHostAction(
                                () => topologyHost.stop?.(),
                                '已请求停止 topology host',
                            )}
                        />
                    ) : null}
                    {topologyHost?.getSharePayload ? (
                        <AdminActionButton
                            testID="ui-base-admin-section:topology:share-payload"
                            label="生成分享"
                            onPress={() => void runHostAction(async () => {
                                const payload = await topologyHost.getSharePayload?.() ?? null
                                setSharePayload(payload)
                                if (!payload) {
                                    throw new Error('当前 host 未提供可分享的配对信息')
                                }
                            }, '已生成 topology 分享信息')}
                        />
                    ) : null}
                    {topologyHost?.importSharePayload && sharePayload ? (
                        <AdminActionButton
                            testID="ui-base-admin-section:topology:import-payload"
                            label="导入当前分享"
                            onPress={() => void runHostAction(
                                () => topologyHost.importSharePayload?.(sharePayload),
                                '已导入 topology 分享信息',
                            )}
                        />
                    ) : null}
                    {topologyHost?.importSharePayload ? (
                        <AdminActionButton
                            testID="ui-base-admin-section:topology:import-json"
                            label="导入JSON"
                            onPress={() => void runHostAction(
                                importSharePayloadJson,
                                '已导入 topology 分享 JSON',
                            )}
                        />
                    ) : null}
                    {topologyHost?.getTopologyHostStatus ? (
                        <AdminActionButton
                            testID="ui-base-admin-section:topology:host-status"
                            label="刷新Host"
                            onPress={() => void runHostAction(
                                () => refreshHostStatus(),
                                '已刷新 host 状态',
                            )}
                        />
                    ) : null}
                </AdminActionGroup>
                {topologyHost?.importSharePayload ? (
                    <View style={{gap: 8}}>
                        <Text style={{fontSize: 13, color: '#526072', fontWeight: '700'}}>
                            分享 JSON
                        </Text>
                        <InputField
                            testID="ui-base-admin-section:topology:share-json-input"
                            value={sharePayloadJson}
                            onChangeText={setSharePayloadJson}
                            mode="virtual-json"
                            placeholder="粘贴 topology 分享 JSON"
                        />
                    </View>
                ) : null}
                <AdminSummaryGrid>
                    <AdminSummaryCard
                        label="分享格式"
                        value={sharePayload?.formatVersion ?? '未生成'}
                        detail={sharePayload ? JSON.stringify(sharePayload) : '点击“生成分享”读取 host 可配对信息。'}
                        tone={sharePayload ? 'ok' : 'neutral'}
                    />
                    <AdminSummaryCard
                        label="诊断快照"
                        value={hostDiagnostics ? '已读取' : '未读取'}
                        detail={hostDiagnostics ? JSON.stringify(hostDiagnostics) : 'host 可选提供 diagnostics。'}
                        tone={hostDiagnostics ? 'primary' : 'neutral'}
                    />
                </AdminSummaryGrid>
            </AdminBlock>
            <AdminBlock
                title="显示模式"
                description="只有独立副机允许手工切换 PRIMARY / SECONDARY。托管副屏由宿主启动参数决定。"
            >
                <AdminActionGroup>
                    <AdminActionButton
                        testID="ui-base-admin-section:topology:set-primary"
                        label="切换主屏"
                        disabled={!displayModeEligibility.allowed}
                        onPress={() => void runtime.dispatchCommand(createCommand(
                            topologyRuntimeV3CommandDefinitions.setDisplayMode,
                            {displayMode: 'PRIMARY'},
                        ))}
                    />
                    <AdminActionButton
                        testID="ui-base-admin-section:topology:set-secondary"
                        label="切换副屏"
                        disabled={!displayModeEligibility.allowed}
                        onPress={() => void runtime.dispatchCommand(createCommand(
                            topologyRuntimeV3CommandDefinitions.setDisplayMode,
                            {displayMode: 'SECONDARY'},
                        ))}
                    />
                </AdminActionGroup>
                <AdminSummaryCard
                    label="显示限制"
                    value={formatAdminStatus(displayModeEligibility.reasonCode)}
                    detail={reasonMessages[displayModeEligibility.reasonCode] ?? displayModeEligibility.reasonCode}
                    tone={displayModeEligibility.allowed ? 'ok' : 'warn'}
                />
            </AdminBlock>
        </AdminSectionShell>
    )
}
