import React, {useCallback, useMemo, useRef, useState} from 'react'
import type {EnhancedStore} from '@reduxjs/toolkit'
import type {KernelRuntimeV2} from '@next/kernel-base-runtime-shell-v2'
import {selectLatestAdapterSummary} from '../../selectors'
import {adminConsoleStateActions} from '../../features/slices'
import {createAdapterDiagnosticsController} from '../../supports/adapterDiagnostics'
import {formatAdapterDiagnosticStatus, formatAdminTimestamp} from '../../supports/adminFormatting'
import type {AdapterDiagnosticsRegistry} from '../../types'
import {
    AdminActionButton,
    AdminBlock,
    AdminPagedList,
    AdminSectionMessage,
    AdminSectionShell,
    AdminSummaryCard,
    AdminSummaryGrid,
} from './AdminSectionPrimitives'
import {useAdminStoreSnapshot} from './useAdminScreenActivity'

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
    const runningRef = useRef(false)
    const controller = useMemo(() => createAdapterDiagnosticsController({
        registry,
    }), [registry])
    const readLatestSummary = useCallback(
        () => selectLatestAdapterSummary(store.getState()),
        [store],
    )
    const latestSummary = useAdminStoreSnapshot(
        store.subscribe,
        readLatestSummary,
    )

    const handleRunAll = async () => {
        if (runningRef.current) {
            return
        }
        runningRef.current = true
        setRunning(true)
        try {
            const summary = await controller.runAll()
            store.dispatch(adminConsoleStateActions.setLatestAdapterSummary(summary))
            setLastMessage(`已完成 ${summary.total} 项测试`)
        } finally {
            runningRef.current = false
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
            <AdminPagedList
                items={controller.listAdapters()}
                pageSize={4}
                itemLabel="个适配器"
                testIDPrefix="ui-base-admin-adapter-diagnostics:adapters"
                keyExtractor={adapterKey => adapterKey}
                renderItem={adapterKey => {
                    const adapterResults = latestSummary?.results.filter(item => item.adapterKey === adapterKey) ?? []
                    const latestAdapterResult = adapterResults[0]
                    return (
                        <AdminBlock
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
                                    value={formatAdapterDiagnosticStatus(latestAdapterResult?.status ?? 'idle')}
                                    detail="最近一次执行中，该适配器的最后一条场景结果。"
                                    tone={
                                        latestAdapterResult?.status === 'passed'
                                            ? 'ok'
                                            : latestAdapterResult?.status === 'failed'
                                                ? 'danger'
                                                : 'neutral'
                                    }
                                />
                                <AdminSummaryCard
                                    label="最近完成"
                                    value={formatAdminTimestamp(latestAdapterResult?.finishedAt)}
                                    detail="最近一次该适配器场景执行完成时间。"
                                    tone={latestAdapterResult?.finishedAt ? 'primary' : 'neutral'}
                                />
                            </AdminSummaryGrid>
                            <AdminPagedList
                                items={adapterResults}
                                pageSize={3}
                                itemLabel="条结果"
                                testIDPrefix={`ui-base-admin-adapter-diagnostics:results:${adapterKey}`}
                                emptyMessage="该适配器还没有最近测试结果。"
                                keyExtractor={result => `${result.adapterKey}:${result.scenarioKey}`}
                                renderItem={result => (
                                    <AdminBlock
                                        title={result.title}
                                        description={result.message}
                                    >
                                        <AdminSummaryGrid>
                                            <AdminSummaryCard
                                                label="场景标识"
                                                value={result.scenarioKey}
                                                detail="适配器场景唯一标识。"
                                                tone="neutral"
                                            />
                                            <AdminSummaryCard
                                                label="执行结果"
                                                value={formatAdapterDiagnosticStatus(result.status)}
                                                detail={`耗时 ${result.durationMs}ms`}
                                                tone={
                                                    result.status === 'passed'
                                                        ? 'ok'
                                                        : result.status === 'failed'
                                                            ? 'danger'
                                                            : 'warn'
                                                }
                                            />
                                            <AdminSummaryCard
                                                label="完成时间"
                                                value={formatAdminTimestamp(result.finishedAt)}
                                                detail="最近一次场景执行完成时间。"
                                                tone={result.finishedAt ? 'primary' : 'neutral'}
                                            />
                                        </AdminSummaryGrid>
                                    </AdminBlock>
                                )}
                            />
                        </AdminBlock>
                    )
                }}
            />
        </AdminSectionShell>
    )
}
