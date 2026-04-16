import React, {useEffect, useState} from 'react'
import type {EnhancedStore} from '@reduxjs/toolkit'
import {createCommand, type KernelRuntimeV2} from '@impos2/kernel-base-runtime-shell-v2'
import {
    selectTopologyRuntimeV2Connection,
    selectTopologyRuntimeV2Context,
    selectTopologyRuntimeV2DisplayMode,
    selectTopologyRuntimeV2EnableSlave,
    selectTopologyRuntimeV2InstanceMode,
    selectTopologyRuntimeV2MasterInfo,
    selectTopologyRuntimeV2Peer,
    selectTopologyRuntimeV2Sync,
    selectTopologyRuntimeV2Workspace,
    topologyRuntimeV2CommandDefinitions,
} from '@impos2/kernel-base-topology-runtime-v2'
import {
    formatAdminStatus,
    formatAdminTimestamp,
} from '../../supports'
import {
    AdminActionGroup,
    AdminActionButton,
    AdminBlock,
    AdminSectionShell,
    AdminSummaryCard,
    AdminSummaryGrid,
} from './AdminSectionPrimitives'

export interface AdminTopologySectionProps {
    runtime: KernelRuntimeV2
    store: EnhancedStore
}

export const AdminTopologySection: React.FC<AdminTopologySectionProps> = ({
    runtime,
    store,
}) => {
    const readSnapshot = () => {
        const state = store.getState()
        return {
            context: selectTopologyRuntimeV2Context(state),
            instanceMode: selectTopologyRuntimeV2InstanceMode(state) ?? 'UNKNOWN',
            displayMode: selectTopologyRuntimeV2DisplayMode(state) ?? 'UNKNOWN',
            workspace: selectTopologyRuntimeV2Workspace(state) ?? 'UNKNOWN',
            localNodeId: selectTopologyRuntimeV2Context(state)?.localNodeId,
            enableSlave: selectTopologyRuntimeV2EnableSlave(state) ?? false,
            masterInfo: selectTopologyRuntimeV2MasterInfo(state),
            connection: selectTopologyRuntimeV2Connection(state),
            peer: selectTopologyRuntimeV2Peer(state),
            sync: selectTopologyRuntimeV2Sync(state),
        }
    }
    const [snapshot, setSnapshot] = useState(readSnapshot)
    const {
        context,
        instanceMode,
        displayMode,
        workspace,
        localNodeId,
        enableSlave,
        masterInfo,
        connection,
        peer,
        sync,
    } = snapshot

    useEffect(() => {
        const updateSnapshot = () => setSnapshot(readSnapshot())
        updateSnapshot()
        return store.subscribe(updateSnapshot)
    }, [store])

    return (
        <AdminSectionShell
            testID="ui-base-admin-section:topology"
            title="实例与拓扑"
            description="查看主副机运行模式、主机信息和当前拓扑连接状态。"
        >
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
            </AdminSummaryGrid>
            <AdminBlock
                title="主机信息"
                description="当终端作为副机或已配置主机信息时，这里显示当前主机身份。"
            >
                <AdminSummaryGrid>
                    <AdminSummaryCard
                        label="主机设备"
                        value={masterInfo?.deviceId ?? '未配置'}
                        detail="当前已保存的主机设备 ID。"
                        tone={masterInfo?.deviceId ? 'primary' : 'neutral'}
                    />
                    <AdminSummaryCard
                        label="保存时间"
                        value={formatAdminTimestamp(masterInfo?.addedAt)}
                        detail="主机信息写入本机恢复状态的时间。"
                        tone={masterInfo?.addedAt ? 'primary' : 'neutral'}
                    />
                    <AdminSummaryCard
                        label="主机地址"
                        value={masterInfo?.serverAddress?.[0]?.address ?? '未配置'}
                        detail="当前优先生效的主机连接地址。"
                        tone={masterInfo?.serverAddress?.[0]?.address ? 'primary' : 'neutral'}
                    />
                    <AdminSummaryCard
                        label="最近错误"
                        value={connection?.connectionError ?? '无'}
                        detail="最近一次拓扑连接失败的错误信息。"
                        tone={connection?.connectionError ? 'danger' : 'ok'}
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
                        value={formatAdminTimestamp(connection?.connectedAt)}
                        detail="最近一次拓扑连接建立时间。"
                        tone={connection?.connectedAt ? 'ok' : 'neutral'}
                    />
                    <AdminSummaryCard
                        label="断开时间"
                        value={formatAdminTimestamp(connection?.disconnectedAt)}
                        detail="最近一次拓扑连接断开时间。"
                        tone={connection?.disconnectedAt ? 'warn' : 'neutral'}
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
                        value={sync?.continuousSyncActive ? '同步中' : '未同步'}
                        detail={`resume: ${sync?.resumeStatus ?? 'idle'}`}
                        tone={sync?.continuousSyncActive ? 'ok' : 'neutral'}
                    />
                    <AdminSummaryCard
                        label="上下文更新时间"
                        value={formatAdminTimestamp(context?.updatedAt)}
                        detail="拓扑上下文最近一次刷新时间。"
                        tone={context?.updatedAt ? 'primary' : 'neutral'}
                    />
                </AdminSummaryGrid>
            </AdminBlock>
            <AdminBlock
                title="拓扑操作"
                description="这里集中提供主副机切换和连接控制，不再拆成多个技术菜单。"
            >
                <AdminActionGroup>
                    <AdminActionButton
                        testID="ui-base-admin-section:topology:set-master"
                        label="切换为主机"
                        onPress={() => void runtime.dispatchCommand(createCommand(
                            topologyRuntimeV2CommandDefinitions.setInstanceMode,
                            {instanceMode: 'MASTER'},
                        ))}
                    />
                    <AdminActionButton
                        testID="ui-base-admin-section:topology:set-slave"
                        label="切换为副机"
                        onPress={() => void runtime.dispatchCommand(createCommand(
                            topologyRuntimeV2CommandDefinitions.setInstanceMode,
                            {instanceMode: 'SLAVE'},
                        ))}
                    />
                    <AdminActionButton
                        testID="ui-base-admin-section:topology:start"
                        label="启动连接"
                        tone="primary"
                        onPress={() => void runtime.dispatchCommand(createCommand(
                            topologyRuntimeV2CommandDefinitions.startTopologyConnection,
                            {},
                        ))}
                    />
                    <AdminActionButton
                        testID="ui-base-admin-section:topology:restart"
                        label="重启连接"
                        onPress={() => void runtime.dispatchCommand(createCommand(
                            topologyRuntimeV2CommandDefinitions.restartTopologyConnection,
                            {},
                        ))}
                    />
                </AdminActionGroup>
            </AdminBlock>
        </AdminSectionShell>
    )
}
