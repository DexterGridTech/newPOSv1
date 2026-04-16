import React, {useMemo, useState} from 'react'
import type {EnhancedStore} from '@reduxjs/toolkit'
import type {KernelRuntimeV2} from '@impos2/kernel-base-runtime-shell-v2'
import {selectLatestAdapterSummary} from '../../selectors'
import {adminConsoleStateActions} from '../../features/slices'
import {createAdapterDiagnosticsController} from '../../supports/adapterDiagnostics'
import {
    formatAdapterDiagnosticStatus,
    formatAdminTimestamp,
} from '../../supports'
import type {AdapterDiagnosticsRegistry} from '../../types'
import {
    AdminActionButton,
    AdminBlock,
    AdminSectionMessage,
    AdminSectionShell,
    AdminSummaryCard,
    AdminSummaryGrid,
} from './AdminSectionPrimitives'

export interface AdapterDiagnosticsScreenProps {
    runtime: KernelRuntimeV2
    store: EnhancedStore
    registry: AdapterDiagnosticsRegistry
}

export const AdapterDiagnosticsScreen: React.FC<AdapterDiagnosticsScreenProps> = ({
    runtime,
    store,
    registry,
}) => {
    const [isRunning, setRunning] = useState(false)
    const [lastMessage, setLastMessage] = useState<string>('')
    const controller = useMemo(() => createAdapterDiagnosticsController({
        registry,
    }), [registry])
    const latestSummary = selectLatestAdapterSummary(store.getState())

    const handleRunAll = async () => {
        if (isRunning) {
            return
        }
        setRunning(true)
        try {
            const summary = await controller.runAll()
            store.dispatch(adminConsoleStateActions.setLatestAdapterSummary(summary))
            setLastMessage(`已完成 ${summary.total} 项测试`)
        } finally {
            setRunning(false)
        }
    }

    return (
        <AdminSectionShell
            testID="ui-base-admin-adapter-diagnostics"
            title="适配器测试"
            description="执行已注册的适配器诊断场景，并按适配器维度查看覆盖与结果。"
        >
            <AdminActionButton
                testID="ui-base-admin-adapter-diagnostics:run-all"
                label={isRunning ? '测试中' : '一键测试'}
                tone="primary"
                disabled={isRunning}
                onPress={() => void handleRunAll()}
            />
            <AdminSectionMessage
                message={
                    lastMessage
                    || latestSummary?.status
                    || (controller.listAdapters().length > 0
                        ? '已加载适配器测试场景'
                        : '当前未注入任何适配器测试场景')
                }
            />
            <AdminSummaryGrid>
                <AdminSummaryCard
                    label="适配器数量"
                    value={`${controller.listAdapters().length}`}
                    detail="当前已注册测试场景的适配器类别。"
                    tone={controller.listAdapters().length > 0 ? 'ok' : 'warn'}
                />
                <AdminSummaryCard
                    label="最近结果"
                    value={formatAdapterDiagnosticStatus(latestSummary?.status ?? 'idle')}
                    detail="最近一次一键测试的总体结果。"
                    tone={
                        latestSummary?.status === 'passed'
                            ? 'ok'
                            : latestSummary?.status === 'failed'
                                ? 'danger'
                                : 'neutral'
                    }
                />
            </AdminSummaryGrid>
            {controller.listAdapters().length === 0 ? (
                <AdminBlock
                    title="等待业务注入测试场景"
                    description="admin-console 不再内置占位诊断。只有业务或集成层显式注入场景后，这里才显示真实的一键测试能力。"
                >
                    <AdminSummaryGrid>
                        <AdminSummaryCard
                            label="当前状态"
                            value="未注入"
                            detail="请在 createModule 中传入 adapterDiagnosticScenarios，或在集成壳层安装诊断场景。"
                            tone="warn"
                        />
                    </AdminSummaryGrid>
                </AdminBlock>
            ) : null}
            {controller.listAdapters().map(adapterKey => (
                <AdminBlock
                    key={adapterKey}
                    title={adapterKey}
                    description="按适配器聚合显示已注册的测试场景数量和执行覆盖。"
                >
                    <AdminSummaryGrid>
                        <AdminSummaryCard
                            label="场景数量"
                            value={`${controller.listScenarios(adapterKey).length}`}
                            detail="当前适配器下已配置的诊断场景。"
                            tone="primary"
                        />
                        <AdminSummaryCard
                            label="最近结果"
                            value={formatAdapterDiagnosticStatus(
                                latestSummary?.results.find(item => item.adapterKey === adapterKey)?.status
                                ?? 'idle',
                            )}
                            detail="最近一次执行中，该适配器的最后一条场景结果。"
                            tone={
                                latestSummary?.results.find(item => item.adapterKey === adapterKey)?.status === 'passed'
                                    ? 'ok'
                                    : latestSummary?.results.find(item => item.adapterKey === adapterKey)?.status === 'failed'
                                        ? 'danger'
                                        : 'neutral'
                            }
                        />
                        <AdminSummaryCard
                            label="最近完成"
                            value={formatAdminTimestamp(
                                latestSummary?.results.find(item => item.adapterKey === adapterKey)?.finishedAt,
                            )}
                            detail="最近一次该适配器场景执行完成时间。"
                            tone={
                                latestSummary?.results.find(item => item.adapterKey === adapterKey)?.finishedAt
                                    ? 'primary'
                                    : 'neutral'
                            }
                        />
                    </AdminSummaryGrid>
                </AdminBlock>
            ))}
        </AdminSectionShell>
    )
}
