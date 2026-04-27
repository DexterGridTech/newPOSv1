import React, {useCallback, useEffect, useState} from 'react'
import {Text, View} from 'react-native'
import type {EnhancedStore} from '@reduxjs/toolkit'
import {
    selectTdpHotUpdateState,
    type HotUpdateState,
} from '@next/kernel-base-tdp-sync-runtime-v2'
import type {
    AdminDetailItem,
    AdminStatusItem,
    AdminVersionHost,
    AdminVersionSnapshot,
} from '../../types'
import {formatAdminStatus, formatAdminTimestamp} from '../../supports/adminFormatting'
import {
    AdminActionButton,
    AdminActionGroup,
    AdminBlock,
    AdminDetailList,
    AdminSectionMessage,
    AdminSectionShell,
    AdminStatusList,
    AdminSummaryCard,
    AdminSummaryGrid,
} from './AdminSectionPrimitives'
import {
    useAdminMountedRef,
    useAdminRefreshWhileScreenActive,
    useAdminStoreSnapshot,
} from './useAdminScreenActivity'

export interface AdminVersionSectionProps {
    store: EnhancedStore
    host?: AdminVersionHost
}

const detail = (
    key: string,
    label: string,
    value: AdminDetailItem['value'],
): AdminDetailItem => ({
    key,
    label,
    value,
})

const compactDetails = (
    items: readonly AdminDetailItem[],
): readonly AdminDetailItem[] =>
    items.filter(item => item.value !== undefined && item.value !== null && item.value !== '')

const formatValue = (
    value: unknown,
): string | number | boolean | null | undefined => {
    if (value === undefined || value === null) {
        return value
    }
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        return value
    }
    const serialized = JSON.stringify(value)
    return serialized.length > 220 ? `${serialized.slice(0, 220)}...` : serialized
}

const formatBytes = (
    value: unknown,
): string | undefined => {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        return undefined
    }
    if (value < 1024) {
        return `${value} B`
    }
    if (value < 1024 * 1024) {
        return `${(value / 1024).toFixed(1)} KB`
    }
    return `${(value / 1024 / 1024).toFixed(1)} MB`
}

const formatTimeValue = (
    value: unknown,
): string | undefined => {
    if (typeof value === 'number') {
        return formatAdminTimestamp(value)
    }
    if (typeof value === 'string' && value.trim()) {
        const parsed = Date.parse(value)
        return Number.isFinite(parsed) ? formatAdminTimestamp(parsed) : value
    }
    return undefined
}

const formatSource = (
    source?: string,
): string => {
    const labels: Record<string, string> = {
        embedded: '内置包',
        'hot-update': '热更新包',
        rollback: '回滚包',
    }
    return source ? labels[source] ?? source : '未知'
}

const sourceTone = (
    source?: string,
): 'primary' | 'ok' | 'warn' | 'neutral' => {
    if (source === 'hot-update') {
        return 'ok'
    }
    if (source === 'rollback') {
        return 'warn'
    }
    if (source === 'embedded') {
        return 'primary'
    }
    return 'neutral'
}

const statusTone = (
    status?: string,
): 'primary' | 'ok' | 'warn' | 'danger' | 'neutral' => {
    if (!status) {
        return 'neutral'
    }
    if (status === 'ready' || status === 'ready-to-restart' || status === 'applied') {
        return 'ok'
    }
    if (status === 'failed') {
        return 'danger'
    }
    if (status === 'compatibility-rejected' || status === 'waiting-idle' || status === 'downloading') {
        return 'warn'
    }
    return 'primary'
}

const toStatusItemTone = (
    tone: ReturnType<typeof statusTone>,
): AdminStatusItem['tone'] =>
    tone === 'danger'
        ? 'error'
        : tone === 'primary'
            ? 'neutral'
            : tone

const buildCurrentDetails = (
    state?: HotUpdateState,
): readonly AdminDetailItem[] =>
    compactDetails([
        detail('current.source', '来源', formatSource(state?.current?.source)),
        detail('current.appId', 'App ID', state?.current?.appId),
        detail('current.assemblyVersion', 'Assembly 版本', state?.current?.assemblyVersion),
        detail('current.buildNumber', 'Build Number', state?.current?.buildNumber),
        detail('current.runtimeVersion', 'Runtime 版本', state?.current?.runtimeVersion),
        detail('current.bundleVersion', 'Bundle 版本', state?.current?.bundleVersion),
        detail('current.packageId', 'Package ID', state?.current?.packageId),
        detail('current.releaseId', 'Release ID', state?.current?.releaseId),
        detail('current.installDir', '安装目录', state?.current?.installDir),
        detail('current.appliedAt', '生效时间', formatAdminTimestamp(state?.current?.appliedAt)),
    ])

const buildDesiredDetails = (
    state?: HotUpdateState,
): readonly AdminDetailItem[] => {
    const desired = state?.desired
    if (!desired) {
        return [detail('desired.empty', '期望发布', '无')]
    }
    return compactDetails([
        detail('desired.releaseId', 'Release ID', desired.releaseId),
        detail('desired.packageId', 'Package ID', desired.packageId),
        detail('desired.appId', 'App ID', desired.appId),
        detail('desired.product', '产品', desired.product),
        detail('desired.bundleVersion', 'Bundle 版本', desired.bundleVersion),
        detail('desired.runtimeVersion', 'Runtime 版本', desired.runtimeVersion),
        detail('desired.packageSize', '包大小', formatBytes(desired.packageSize)),
        detail('desired.rolloutMode', '发布模式', desired.rollout.mode),
        detail('desired.publishedAt', '发布时间', formatTimeValue(desired.rollout.publishedAt)),
        detail('desired.expiresAt', '过期时间', formatTimeValue(desired.rollout.expiresAt)),
        detail('desired.restartMode', '重启模式', desired.restart.mode),
        detail('desired.maxDownloadAttempts', '最大下载次数', desired.safety.maxDownloadAttempts),
        detail('desired.maxLaunchFailures', '最大启动失败数', desired.safety.maxLaunchFailures),
        detail('desired.operator', '操作人', desired.metadata?.operator),
        detail('desired.reason', '发布原因', desired.metadata?.reason),
    ])
}

const buildCandidateStatuses = (
    state?: HotUpdateState,
): readonly AdminStatusItem[] => {
    const candidate = state?.candidate
    const ready = state?.ready
    const applying = state?.applying
    const restartIntent = state?.restartIntent
    const lastError = state?.lastError

    return [
        {
            key: 'candidate',
            label: '候选包',
            value: candidate ? formatAdminStatus(candidate.status) : '无',
            detail: candidate
                ? `${candidate.bundleVersion} / ${candidate.packageId} / attempts ${candidate.attempts}`
                : '当前没有下载候选包。',
            tone: toStatusItemTone(statusTone(candidate?.status)),
        },
        {
            key: 'ready',
            label: '已下载包',
            value: ready ? '可应用' : '无',
            detail: ready
                ? `${ready.bundleVersion} / ${ready.installDir} / ${formatAdminTimestamp(ready.readyAt)}`
                : '当前没有已下载且可应用的包。',
            tone: ready ? 'ok' : 'neutral',
        },
        {
            key: 'applying',
            label: '待启动应用',
            value: applying ? '已写入' : '无',
            detail: applying
                ? `${applying.bundleVersion} / ${applying.bootMarkerPath ?? 'boot marker 未返回路径'}`
                : '当前没有等待下次启动应用的包。',
            tone: applying ? 'warn' : 'neutral',
        },
        {
            key: 'restartIntent',
            label: '重启意图',
            value: restartIntent ? formatAdminStatus(restartIntent.status) : '无',
            detail: restartIntent
                ? `${restartIntent.mode} / next ${formatAdminTimestamp(restartIntent.nextEligibleAt)}`
                : '当前没有热更新重启意图。',
            tone: toStatusItemTone(statusTone(restartIntent?.status)),
        },
        {
            key: 'lastError',
            label: '最近异常',
            value: lastError?.code ?? '无',
            detail: lastError
                ? `${lastError.message} / ${formatAdminTimestamp(lastError.at)}`
                : '当前热更新状态没有记录异常。',
            tone: lastError ? 'error' : 'ok',
        },
    ]
}

const buildReadyDetails = (
    state?: HotUpdateState,
): readonly AdminDetailItem[] =>
    compactDetails([
        detail('ready.releaseId', 'Ready Release ID', state?.ready?.releaseId),
        detail('ready.packageId', 'Ready Package ID', state?.ready?.packageId),
        detail('ready.bundleVersion', 'Ready Bundle', state?.ready?.bundleVersion),
        detail('ready.installDir', '安装目录', state?.ready?.installDir),
        detail('ready.entryFile', '入口文件', state?.ready?.entryFile),
        detail('ready.packageSha256', 'Package SHA256', state?.ready?.packageSha256),
        detail('ready.manifestSha256', 'Manifest SHA256', state?.ready?.manifestSha256),
        detail('ready.readyAt', 'Ready 时间', formatAdminTimestamp(state?.ready?.readyAt)),
        detail('applying.bootMarkerPath', 'Boot Marker 路径', state?.applying?.bootMarkerPath),
        detail('applying.startedAt', '应用开始时间', formatAdminTimestamp(state?.applying?.startedAt)),
    ])

const markerDetails = (
    keyPrefix: string,
    marker: Record<string, unknown> | null | undefined,
): readonly AdminDetailItem[] => {
    if (!marker || Object.keys(marker).length === 0) {
        return [detail(`${keyPrefix}.empty`, '状态', '未写入')]
    }
    return Object.keys(marker)
        .sort()
        .map(key => detail(`${keyPrefix}.${key}`, key, formatValue(marker[key])))
}

const buildHistoryStatuses = (
    state?: HotUpdateState,
): readonly AdminStatusItem[] =>
    (state?.history ?? [])
        .slice(-10)
        .reverse()
        .map((item, index) => ({
            key: `history.${index}.${item.event}.${item.at}`,
            label: formatAdminStatus(item.event),
            value: formatAdminTimestamp(item.at),
            detail: [
                item.bundleVersion,
                item.releaseId,
                item.packageId,
                item.reason,
            ].filter(Boolean).join(' / ') || '无附加信息',
            tone: item.event.includes('failed') || item.event === 'compatibility-rejected'
                ? 'error'
                : item.event === 'ready' || item.event === 'applied' || item.event === 'version-reported'
                    ? 'ok'
                    : 'neutral',
        }))

const readSnapshot = (
    store: EnhancedStore,
): HotUpdateState | undefined =>
    selectTdpHotUpdateState(store.getState())

const MarkerGroup: React.FC<{
    title: string
    items: readonly AdminDetailItem[]
}> = ({title, items}) => (
    <View style={{gap: 8}}>
        <Text style={{fontSize: 13, color: '#0f172a', fontWeight: '800'}}>
            {title}
        </Text>
        <AdminDetailList items={items} />
    </View>
)

export const AdminVersionSection: React.FC<AdminVersionSectionProps> = ({
    store,
    host,
}) => {
    const mountedRef = useAdminMountedRef()
    const readStoreSnapshot = useCallback(() => readSnapshot(store), [store])
    const state = useAdminStoreSnapshot(store.subscribe, readStoreSnapshot)
    const [hostSnapshot, setHostSnapshot] = useState<AdminVersionSnapshot | undefined>()
    const [message, setMessage] = useState('')
    const [loading, setLoading] = useState(false)
    const historyItems = buildHistoryStatuses(state)
    const readyDetails = buildReadyDetails(state)

    const refreshHostSnapshot = useCallback((successMessage?: string) => {
        if (!host) {
            setHostSnapshot(undefined)
            return
        }
        void (async () => {
            setLoading(true)
            setMessage('')
            try {
                const snapshot = await host.getSnapshot()
                if (!mountedRef.current) {
                    return
                }
                setHostSnapshot(snapshot)
                if (successMessage) {
                    setMessage(successMessage)
                }
            } catch (error) {
                if (mountedRef.current) {
                    setMessage(error instanceof Error ? error.message : '版本宿主状态读取失败')
                }
            } finally {
                if (mountedRef.current) {
                    setLoading(false)
                }
            }
        })()
    }, [host])

    useAdminRefreshWhileScreenActive(
        () => refreshHostSnapshot(),
        host ? 'host-ready' : 'host-missing',
    )

    const clearBootMarker = () => {
        if (!host?.clearBootMarker) {
            return
        }
        void (async () => {
            setLoading(true)
            setMessage('')
            try {
                await host.clearBootMarker?.()
                refreshHostSnapshot('已清除 Boot Marker')
            } catch (error) {
                if (mountedRef.current) {
                    setMessage(error instanceof Error ? error.message : 'Boot Marker 清除失败')
                    setLoading(false)
                }
            }
        })()
    }

    return (
        <AdminSectionShell
            testID="ui-base-admin-section:version"
            title="版本管理"
            description="查看当前终端版本、热更新发布状态、下载应用状态和宿主启动标记。"
        >
            <AdminSectionMessage message={message || undefined} />
            <AdminSummaryGrid>
                <AdminSummaryCard
                    label="当前 Bundle"
                    value={state?.current?.bundleVersion ?? '未记录'}
                    detail={state?.current?.releaseId ?? state?.current?.packageId ?? '当前生效的 bundle 版本。'}
                    tone={sourceTone(state?.current?.source)}
                />
                <AdminSummaryCard
                    label="版本来源"
                    value={formatSource(state?.current?.source)}
                    detail={state?.current?.installDir ?? '内置版本通常没有安装目录。'}
                    tone={sourceTone(state?.current?.source)}
                />
                <AdminSummaryCard
                    label="期望 Bundle"
                    value={state?.desired?.bundleVersion ?? '无'}
                    detail={state?.desired?.releaseId ?? '平台当前没有下发待处理版本。'}
                    tone={state?.desired ? 'primary' : 'neutral'}
                />
                <AdminSummaryCard
                    label="候选状态"
                    value={state?.candidate ? formatAdminStatus(state.candidate.status) : '无'}
                    detail={state?.candidate?.reason ?? state?.candidate?.packageId ?? '没有下载候选包。'}
                    tone={statusTone(state?.candidate?.status)}
                />
                <AdminSummaryCard
                    label="Ready 包"
                    value={state?.ready?.bundleVersion ?? '无'}
                    detail={state?.ready ? formatAdminTimestamp(state.ready.readyAt) : '没有可应用包。'}
                    tone={state?.ready ? 'ok' : 'neutral'}
                />
                <AdminSummaryCard
                    label="重启状态"
                    value={state?.restartIntent ? formatAdminStatus(state.restartIntent.status) : '无'}
                    detail={state?.restartIntent?.mode ?? '没有热更新重启意图。'}
                    tone={statusTone(state?.restartIntent?.status)}
                />
                <AdminSummaryCard
                    label="Boot Marker"
                    value={hostSnapshot?.nativeMarkers?.boot ? '已写入' : '未写入'}
                    detail={host ? '宿主 native marker 读取结果。' : '当前版本宿主能力未安装。'}
                    tone={hostSnapshot?.nativeMarkers?.boot ? 'warn' : 'neutral'}
                />
                <AdminSummaryCard
                    label="历史事件"
                    value={`${state?.history?.length ?? 0}`}
                    detail="热更新状态机最近记录的事件数量。"
                    tone={(state?.history?.length ?? 0) > 0 ? 'primary' : 'neutral'}
                />
            </AdminSummaryGrid>

            <AdminBlock
                title="当前运行版本"
                description="来自 tdp-sync-runtime-v2 hot-update.current 的当前生效版本事实。"
            >
                <AdminDetailList items={buildCurrentDetails(state)} />
            </AdminBlock>

            {hostSnapshot?.embeddedRelease?.length ? (
                <AdminBlock
                    title="内置发布信息"
                    description="由宿主注入的 assembly releaseInfo，用于对照当前运行版本。"
                >
                    <AdminDetailList items={hostSnapshot.embeddedRelease} />
                </AdminBlock>
            ) : null}

            <AdminBlock
                title="期望发布"
                description="平台下发的 desired release 以及兼容、发布、重启和安全策略。"
            >
                <AdminDetailList items={buildDesiredDetails(state)} />
            </AdminBlock>

            <AdminBlock
                title="下载与应用状态"
                description="候选包、ready 包、applying 状态和重启意图。"
            >
                <AdminStatusList items={buildCandidateStatuses(state)} />
                {readyDetails.length ? <AdminDetailList items={readyDetails} /> : null}
            </AdminBlock>

            <AdminBlock
                title="Native 标记"
                description="读取宿主 boot、active、rollback marker，用于判断下次启动或回滚状态。"
            >
                <AdminActionGroup>
                    <AdminActionButton
                        testID="ui-base-admin-section:version:refresh"
                        label={loading ? '刷新中' : '刷新标记'}
                        tone="primary"
                        disabled={loading || !host}
                        onPress={() => refreshHostSnapshot('已刷新版本宿主状态')}
                    />
                    <AdminActionButton
                        testID="ui-base-admin-section:version:clear-boot-marker"
                        label="清除 Boot Marker"
                        tone="danger"
                        disabled={loading || !host?.clearBootMarker || !hostSnapshot?.nativeMarkers?.boot}
                        onPress={clearBootMarker}
                    />
                </AdminActionGroup>
                {hostSnapshot?.capabilities?.length ? (
                    <AdminStatusList items={hostSnapshot.capabilities} />
                ) : null}
                <MarkerGroup
                    title="Boot Marker"
                    items={markerDetails('boot', hostSnapshot?.nativeMarkers?.boot)}
                />
                <MarkerGroup
                    title="Active Marker"
                    items={markerDetails('active', hostSnapshot?.nativeMarkers?.active)}
                />
                <MarkerGroup
                    title="Rollback Marker"
                    items={markerDetails('rollback', hostSnapshot?.nativeMarkers?.rollback)}
                />
            </AdminBlock>

            {historyItems.length ? (
                <AdminBlock
                    title="历史事件"
                    description="最近 10 条 hot-update 状态机事件。"
                >
                    <AdminStatusList items={historyItems} />
                </AdminBlock>
            ) : null}
        </AdminSectionShell>
    )
}
