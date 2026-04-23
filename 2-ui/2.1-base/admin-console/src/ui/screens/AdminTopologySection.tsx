import React, {useCallback, useEffect, useState} from 'react'
import {Text, View} from 'react-native'
import QRCode from 'react-native-qrcode-svg'
import type {EnhancedStore} from '@reduxjs/toolkit'
import {
    createCommand,
    type KernelRuntimeV2,
} from '@impos2/kernel-base-runtime-shell-v2'
import {
    createTopologyV3CompactSharePayload,
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
import {adminConsoleCommandDefinitions} from '../../features/commands'
import {formatAdminStatus, formatAdminTimestamp} from '../../supports/adminFormatting'
import {
    AdminActionGroup,
    AdminActionButton,
    AdminBlock,
    AdminSectionMessage,
    AdminSectionShell,
    AdminSummaryCard,
    AdminSummaryGrid,
} from './AdminSectionPrimitives'
import type {AdminTopologyHost, AdminTopologySharePayload} from '../../types'

export interface AdminTopologySectionProps {
    runtime: KernelRuntimeV2
    store: EnhancedStore
    host?: AdminTopologyHost
}

export const AdminTopologySection: React.FC<AdminTopologySectionProps> = ({
    runtime,
    store,
    host,
}) => {
    const topologyHost = host
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
    const [scanRunning, setScanRunning] = useState(false)
    const [scanStatusLabel, setScanStatusLabel] = useState('未开始')
    const [scanDetail, setScanDetail] = useState<string | undefined>()
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
        const result = await runtime.dispatchCommand(createCommand(
            adminConsoleCommandDefinitions.refreshTopologyHostStatus,
            {},
        ))
        const payload = result.actorResults[0]?.result as {
            topologyHostStatus?: Record<string, unknown> | null
            topologyHostDiagnostics?: Record<string, unknown> | null
        } | undefined
        setHostStatus(payload?.topologyHostStatus ?? null)
        setHostDiagnostics(payload?.topologyHostDiagnostics ?? null)
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

    useEffect(() => {
        const updateSnapshot = () => setSnapshot(readSnapshot())
        updateSnapshot()
        return store.subscribe(updateSnapshot)
    }, [store])

    useEffect(() => {
        void refreshHostStatus()
    }, [topologyHost])

    const handleScanMaster = async () => {
        if (scanRunning) {
            return
        }
        if (!topologyHost?.importSharePayload) {
            throw new Error('当前宿主不支持导入 topology 分享信息')
        }
        setMessage('已发起扫码任务，请对准主机二维码')
        setSharePayload(null)
        setScanRunning(true)
        setScanStatusLabel('扫码中')
        setScanDetail(undefined)
        try {
            const result = await runtime.dispatchCommand(createCommand(
                adminConsoleCommandDefinitions.scanAndImportTopologyMaster,
                {
                    scanMode: 'QR_CODE_MODE',
                    timeoutMs: 60_000,
                    reconnect: true,
                },
            ))
            const actorResult = result.actorResults[0]?.result as {
                sharePayload?: AdminTopologySharePayload
            } | undefined
            if (result.status !== 'COMPLETED' || !actorResult?.sharePayload) {
                throw new Error(result.actorResults[0]?.error?.message ?? '扫码任务执行失败')
            }
            setSharePayload(actorResult.sharePayload)
            setScanStatusLabel('已完成')
            setScanDetail(result.requestId)
            setMessage('扫码成功，已导入主机信息')
            await refreshHostStatus()
        } catch (error) {
            setScanStatusLabel('失败')
            setScanDetail(error instanceof Error ? error.message : '扫码结果处理失败')
            setMessage(error instanceof Error ? error.message : '扫码结果处理失败')
        } finally {
            setScanRunning(false)
        }
    }

    const qrValue = sharePayload ? JSON.stringify(createTopologyV3CompactSharePayload(sharePayload)) : null

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
                description="主机生成二维码供副机扫码；副机通过通用扫码 task 获取主机信息后完成配对。"
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
                        onPress={() => void runtime.dispatchCommand(createCommand(
                            adminConsoleCommandDefinitions.clearTopologyMasterLocator,
                            {},
                        ))}
                    />
                    {topologyHost?.reconnect ? (
                        <AdminActionButton
                            testID="ui-base-admin-section:topology:reconnect"
                            label="重新连接"
                            tone="primary"
                            onPress={() => void runHostAction(
                                async () => {
                                    const result = await runtime.dispatchCommand(createCommand(
                                        adminConsoleCommandDefinitions.reconnectTopologyHost,
                                        {},
                                    ))
                                    if (result.status !== 'COMPLETED') {
                                        throw new Error(result.actorResults[0]?.error?.message ?? '重连 host 失败')
                                    }
                                },
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
                                async () => {
                                    const result = await runtime.dispatchCommand(createCommand(
                                        adminConsoleCommandDefinitions.stopTopologyHost,
                                        {},
                                    ))
                                    if (result.status !== 'COMPLETED') {
                                        throw new Error(result.actorResults[0]?.error?.message ?? '停止 host 失败')
                                    }
                                },
                                '已请求停止 topology host',
                            )}
                        />
                    ) : null}
                    {topologyHost?.getSharePayload ? (
                        <AdminActionButton
                            testID="ui-base-admin-section:topology:share-payload"
                            label="生成分享"
                            onPress={() => void runHostAction(async () => {
                                const result = await runtime.dispatchCommand(createCommand(
                                    adminConsoleCommandDefinitions.generateTopologySharePayload,
                                    {},
                                ))
                                const payload = (result.actorResults[0]?.result as {
                                    sharePayload?: AdminTopologySharePayload
                                } | undefined)?.sharePayload ?? null
                                setSharePayload(payload)
                                if (!payload) {
                                    throw new Error('当前 host 未提供可分享的配对信息')
                                }
                            }, '已生成 topology 分享信息')}
                        />
                    ) : null}
                    {instanceMode === 'SLAVE' ? (
                        <AdminActionButton
                            testID="ui-base-admin-section:topology:scan-master"
                            label={scanRunning ? '扫码进行中' : '扫码添加主机'}
                            tone="primary"
                            disabled={scanRunning}
                            onPress={() => void handleScanMaster()}
                        />
                    ) : null}
                    {instanceMode === 'SLAVE' && topologyHost?.importSharePayload && sharePayload ? (
                        <AdminActionButton
                            testID="ui-base-admin-section:topology:import-payload"
                            label="重新导入当前扫码结果"
                            onPress={() => void runHostAction(
                                async () => {
                                    const result = await runtime.dispatchCommand(createCommand(
                                        adminConsoleCommandDefinitions.importTopologySharePayload,
                                        {sharePayload},
                                    ))
                                    if (result.status !== 'COMPLETED') {
                                        throw new Error(result.actorResults[0]?.error?.message ?? '导入 topology 分享信息失败')
                                    }
                                },
                                '已导入 topology 分享信息',
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
                <AdminSummaryGrid>
                    <AdminSummaryCard
                        label="分享格式"
                        value={sharePayload?.formatVersion ?? '未生成'}
                        detail={sharePayload ? JSON.stringify(sharePayload) : '主机点击“生成分享”后可展示二维码，副机扫码后会记录当前结果。'}
                        tone={sharePayload ? 'ok' : 'neutral'}
                    />
                    <AdminSummaryCard
                        label="扫码任务"
                        value={scanStatusLabel}
                        detail={scanDetail ?? '副机通过 admin command 间接执行通用扫码 task 获取主机信息。'}
                        tone={scanRunning ? 'warn' : scanStatusLabel === '已完成' ? 'ok' : scanStatusLabel === '失败' ? 'danger' : 'neutral'}
                    />
                    <AdminSummaryCard
                        label="诊断快照"
                        value={hostDiagnostics ? '已读取' : '未读取'}
                        detail={hostDiagnostics ? JSON.stringify(hostDiagnostics) : 'host 可选提供 diagnostics。'}
                        tone={hostDiagnostics ? 'primary' : 'neutral'}
                    />
                </AdminSummaryGrid>
                {instanceMode === 'MASTER' && qrValue ? (
                    <View style={{gap: 8}}>
                        <Text style={{fontSize: 13, color: '#526072', fontWeight: '700'}}>
                            主机配对二维码
                        </Text>
                        <View
                            style={{
                                alignSelf: 'flex-start',
                                padding: 14,
                                borderRadius: 16,
                                backgroundColor: '#ffffff',
                                borderWidth: 1,
                                borderColor: '#d7e1ec',
                                gap: 8,
                            }}
                        >
                            <QRCode
                                value={qrValue}
                                size={180}
                            />
                            <Text style={{fontSize: 12, color: '#526072'}}>
                                请使用副机上的“扫码添加主机”完成配对
                            </Text>
                        </View>
                    </View>
                ) : null}
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
