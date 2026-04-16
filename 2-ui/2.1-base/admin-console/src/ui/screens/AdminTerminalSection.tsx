import React, {useEffect, useState} from 'react'
import type {EnhancedStore} from '@reduxjs/toolkit'
import {
    selectTcpBindingSnapshot,
    selectTcpCredentialSnapshot,
    selectTcpIdentitySnapshot,
    selectTcpRuntimeState,
    tcpControlV2CommandDefinitions,
} from '@impos2/kernel-base-tcp-control-runtime-v2'
import {createCommand, type KernelRuntimeV2} from '@impos2/kernel-base-runtime-shell-v2'
import {
    formatAdminStatus,
    formatAdminTimestamp,
} from '../../supports'
import {
    AdminActionGroup,
    AdminActionButton,
    AdminBlock,
    AdminSectionMessage,
    AdminSectionShell,
    AdminSummaryCard,
    AdminSummaryGrid,
} from './AdminSectionPrimitives'

export interface AdminTerminalSectionProps {
    runtime: KernelRuntimeV2
    store: EnhancedStore
}

export const AdminTerminalSection: React.FC<AdminTerminalSectionProps> = ({
    runtime,
    store,
}) => {
    const [snapshot, setSnapshot] = useState(() => ({
        identity: selectTcpIdentitySnapshot(store.getState()),
        credential: selectTcpCredentialSnapshot(store.getState()),
        binding: selectTcpBindingSnapshot(store.getState()),
        runtimeState: selectTcpRuntimeState(store.getState()),
    }))
    const [message, setMessage] = useState('')
    const [loading, setLoading] = useState(false)
    const {identity, credential, binding, runtimeState} = snapshot

    useEffect(() => {
        const updateSnapshot = () => {
            const state = store.getState()
            setSnapshot({
                identity: selectTcpIdentitySnapshot(state),
                credential: selectTcpCredentialSnapshot(state),
                binding: selectTcpBindingSnapshot(state),
                runtimeState: selectTcpRuntimeState(state),
            })
        }
        updateSnapshot()
        return store.subscribe(updateSnapshot)
    }, [store])

    const refreshSnapshot = () => {
        const state = store.getState()
        setSnapshot({
            identity: selectTcpIdentitySnapshot(state),
            credential: selectTcpCredentialSnapshot(state),
            binding: selectTcpBindingSnapshot(state),
            runtimeState: selectTcpRuntimeState(state),
        })
    }

    const deactivate = () => {
        void (async () => {
            setLoading(true)
            setMessage('')
            try {
                const result = await runtime.dispatchCommand(createCommand(
                    tcpControlV2CommandDefinitions.deactivateTerminal,
                    {reason: 'admin-console'},
                ))
                refreshSnapshot()
                setMessage(result.status === 'COMPLETED' ? '终端已注销激活' : '注销激活未完成')
            } catch (error) {
                setMessage(error instanceof Error ? error.message : '注销激活失败')
            } finally {
                setLoading(false)
            }
        })()
    }

    return (
        <AdminSectionShell
            testID="ui-base-admin-section:terminal"
            title="终端管理"
            description="查看终端激活、凭证、业务绑定和最近控制面异常，并在必要时执行注销激活。"
        >
            <AdminSummaryGrid>
                <AdminSummaryCard
                    label="激活状态"
                    value={formatAdminStatus(identity.activationStatus)}
                    detail="终端当前是否已完成平台激活。"
                    tone={identity.activationStatus === 'ACTIVATED' ? 'ok' : 'warn'}
                />
                <AdminSummaryCard
                    label="终端 ID"
                    value={identity.terminalId ?? '未激活'}
                    detail="平台分配给当前终端的唯一标识。"
                    tone={identity.terminalId ? 'primary' : 'neutral'}
                />
                <AdminSummaryCard
                    label="凭证状态"
                    value={formatAdminStatus(credential.status)}
                    detail="访问令牌和刷新令牌的当前状态。"
                    tone={credential.status === 'READY' ? 'ok' : 'warn'}
                />
                <AdminSummaryCard
                    label="激活时间"
                    value={formatAdminTimestamp(identity.activatedAt)}
                    detail="终端身份写入本机状态的时间。"
                    tone={identity.activatedAt ? 'primary' : 'neutral'}
                />
                <AdminSummaryCard
                    label="凭证过期"
                    value={formatAdminTimestamp(credential.expiresAt)}
                    detail="访问令牌失效时间，用于判断是否需要刷新。"
                    tone={credential.expiresAt ? 'primary' : 'neutral'}
                />
                <AdminSummaryCard
                    label="刷新令牌过期"
                    value={formatAdminTimestamp(credential.refreshExpiresAt)}
                    detail="刷新凭证失效后通常需要重新激活。"
                    tone={credential.refreshExpiresAt ? 'primary' : 'neutral'}
                />
                <AdminSummaryCard
                    label="凭证更新时间"
                    value={formatAdminTimestamp(credential.updatedAt)}
                    detail="最后一次写入访问凭证的时间。"
                    tone={credential.updatedAt ? 'primary' : 'neutral'}
                />
            </AdminSummaryGrid>
            <AdminBlock
                title="业务绑定"
                description="终端激活后从平台写入的租户、门店、品牌和模板上下文。"
            >
                <AdminSummaryGrid>
                    <AdminSummaryCard
                        label="平台"
                        value={binding.platformId ?? '未绑定'}
                        detail="平台级绑定标识。"
                        tone={binding.platformId ? 'primary' : 'neutral'}
                    />
                    <AdminSummaryCard
                        label="项目"
                        value={binding.projectId ?? '未绑定'}
                        detail="项目级绑定标识。"
                        tone={binding.projectId ? 'primary' : 'neutral'}
                    />
                    <AdminSummaryCard
                        label="品牌"
                        value={binding.brandId ?? '未绑定'}
                        detail="品牌级绑定标识。"
                        tone={binding.brandId ? 'primary' : 'neutral'}
                    />
                    <AdminSummaryCard
                        label="租户"
                        value={binding.tenantId ?? '未绑定'}
                        detail="租户级绑定标识。"
                        tone={binding.tenantId ? 'primary' : 'neutral'}
                    />
                    <AdminSummaryCard
                        label="门店"
                        value={binding.storeId ?? '未绑定'}
                        detail="门店级绑定标识。"
                        tone={binding.storeId ? 'primary' : 'neutral'}
                    />
                    <AdminSummaryCard
                        label="模板"
                        value={binding.templateId ?? '未绑定'}
                        detail="终端使用的配置模板。"
                        tone={binding.templateId ? 'primary' : 'neutral'}
                    />
                </AdminSummaryGrid>
            </AdminBlock>
            <AdminBlock
                title="控制面观测"
                description="展示 TCP 控制面最近的请求与异常，便于定位激活、刷新凭证或任务上报问题。"
            >
                <AdminSummaryGrid>
                    <AdminSummaryCard
                        label="启动状态"
                        value={runtimeState?.bootstrapped ? '已初始化' : '未初始化'}
                        detail="TCP 控制面是否已完成 bootstrap。"
                        tone={runtimeState?.bootstrapped ? 'ok' : 'warn'}
                    />
                    <AdminSummaryCard
                        label="激活请求"
                        value={runtimeState?.lastActivationRequestId ?? '未记录'}
                        detail="最近一次激活请求 ID。"
                        tone={runtimeState?.lastActivationRequestId ? 'primary' : 'neutral'}
                    />
                    <AdminSummaryCard
                        label="刷新请求"
                        value={runtimeState?.lastRefreshRequestId ?? '未记录'}
                        detail="最近一次凭证刷新请求 ID。"
                        tone={runtimeState?.lastRefreshRequestId ? 'primary' : 'neutral'}
                    />
                    <AdminSummaryCard
                        label="任务上报请求"
                        value={runtimeState?.lastTaskReportRequestId ?? '未记录'}
                        detail="最近一次任务结果上报请求 ID。"
                        tone={runtimeState?.lastTaskReportRequestId ? 'primary' : 'neutral'}
                    />
                    <AdminSummaryCard
                        label="最近异常"
                        value={runtimeState?.lastError?.message ?? '无'}
                        detail={runtimeState?.lastError?.key ?? '控制面暂无异常。'}
                        tone={runtimeState?.lastError ? 'danger' : 'ok'}
                    />
                </AdminSummaryGrid>
            </AdminBlock>
            <AdminSectionMessage message={message || undefined} />
            {identity.activationStatus === 'ACTIVATED' ? (
                <AdminBlock
                    title="终端操作"
                    description="注销激活会清空本机终端身份和相关运行时状态。"
                >
                    <AdminActionGroup>
                        <AdminActionButton
                            testID="ui-base-admin-section:terminal:deactivate"
                            label="注销激活"
                            tone="danger"
                            disabled={loading}
                            onPress={deactivate}
                        />
                    </AdminActionGroup>
                </AdminBlock>
            ) : null}
        </AdminSectionShell>
    )
}
