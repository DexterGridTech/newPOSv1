import React, {useCallback, useEffect, useMemo, useState} from 'react'
import {Pressable, Text, View} from 'react-native'
import type {EnhancedStore} from '@reduxjs/toolkit'
import {
    selectTcpBindingSnapshot,
    selectTcpIdentitySnapshot,
    selectTcpSandboxId,
} from '@next/kernel-base-tcp-control-runtime-v2'
import {
    selectTdpOperationsSnapshot,
    type TdpOperationsFinding,
    type TdpOperationsSnapshot,
    type TdpOperationsTopicSnapshot,
} from '@next/kernel-base-tdp-sync-runtime-v2'
import {formatAdminStatus, formatAdminTimestamp} from '../../supports/adminFormatting'
import {
    type AdminTdpHost,
    type AdminTdpServerOperationsSnapshot,
} from '../../types'
import {
    AdminActionButton,
    AdminActionGroup,
    AdminBlock,
    AdminDetailList,
    AdminPagedList,
    AdminPagedText,
    AdminSectionMessage,
    AdminSectionShell,
    AdminStatusList,
    AdminSummaryCard,
    AdminSummaryGrid,
    useAdminAutomationNode,
} from './AdminSectionPrimitives'
import {
    shallowEqualAdminSnapshot,
    useAdminStoreSnapshot,
} from './useAdminScreenActivity'

export interface AdminTdpSectionProps {
    store: EnhancedStore
    host?: AdminTdpHost
}

type TdpSubTab =
    | 'overview'
    | 'topics'
    | 'topicDetails'
    | 'pipeline'
    | 'storage'
    | 'events'
    | 'server'

type TopicFilter = 'all' | 'abnormal' | TdpOperationsTopicSnapshot['status']
type ServerSnapshotStatus = 'idle' | 'loading' | 'ready' | 'failed' | 'unavailable'

interface ServerSnapshotOwner {
    sandboxId: string
    terminalId: string
}

interface AdminTdpTerminalSnapshot {
    sandboxId?: string
    terminalId?: string
    profileId?: string
    templateId?: string
    platformId?: string
    projectId?: string
    brandId?: string
    tenantId?: string
    storeId?: string
}

const subTabs: Array<{
    key: TdpSubTab
    title: string
}> = [
    {key: 'overview', title: '总览'},
    {key: 'topics', title: 'Topic 对比'},
    {key: 'topicDetails', title: 'Topic 明细'},
    {key: 'pipeline', title: '同步流水线'},
    {key: 'storage', title: '本地存储'},
    {key: 'events', title: '事件与告警'},
    {key: 'server', title: '服务端诊断'},
]

const formatNumber = (value: number | undefined): string =>
    typeof value === 'number' && Number.isFinite(value) ? `${value}` : '未记录'

const formatList = (items: readonly string[] | undefined): string =>
    items && items.length > 0 ? items.join(', ') : '无'

const formatRate = (value: number): string =>
    `${value.toFixed(value % 1 === 0 ? 0 : 2)}/min`

const formatSource = (value: TdpOperationsTopicSnapshot['activity']['lastSource']): string => {
    if (value === 'snapshot') {
        return 'Snapshot'
    }
    if (value === 'changes') {
        return 'Changes'
    }
    if (value === 'realtime') {
        return 'Realtime'
    }
    return '未记录'
}

const toSummaryTone = (
    tone: TdpOperationsFinding['tone'],
): 'ok' | 'warn' | 'danger' | 'neutral' =>
    tone === 'error' ? 'danger' : tone

const toStatusTone = (
    tone: TdpOperationsFinding['tone'],
) => tone === 'error' ? 'error' : tone

const getSessionTone = (
    status: TdpOperationsSnapshot['session']['status'],
): 'ok' | 'warn' | 'danger' | 'neutral' => {
    if (status === 'READY') {
        return 'ok'
    }
    if (status === 'ERROR' || status === 'REHOME_REQUIRED' || status === 'DISCONNECTED') {
        return 'danger'
    }
    if (status === 'IDLE') {
        return 'neutral'
    }
    return 'warn'
}

const getTopicStatusLabel = (topic: TdpOperationsTopicSnapshot): string => {
    switch (topic.status) {
        case 'accepted':
            return '已接受'
        case 'rejected':
            return '已拒绝'
        case 'required-missing':
            return 'Required 缺失'
        case 'local-residual':
            return '本地残留'
        case 'local-only':
            return '本地请求'
        case 'inactive':
            return '未订阅'
        default:
            return topic.status
    }
}

const getTopicTone = (
    topic: TdpOperationsTopicSnapshot,
): 'ok' | 'warn' | 'danger' | 'neutral' => {
    if (topic.status === 'required-missing') {
        return 'danger'
    }
    if (topic.status === 'rejected' || topic.status === 'local-residual') {
        return 'warn'
    }
    if (topic.status === 'accepted') {
        return 'ok'
    }
    return 'neutral'
}

const isAbnormalTopic = (topic: TdpOperationsTopicSnapshot): boolean =>
    topic.status === 'required-missing'
    || topic.status === 'rejected'
    || topic.status === 'local-residual'

const asServerTopicSet = (
    serverSnapshot?: AdminTdpServerOperationsSnapshot,
) => new Set(serverSnapshot?.subscription?.serverAvailableTopics ?? serverSnapshot?.resolvedTopics?.availableTopics ?? [])

const isServerSnapshotOwnerCurrent = (
    owner: ServerSnapshotOwner | undefined,
    terminal: AdminTdpTerminalSnapshot,
): boolean =>
    Boolean(
        owner
        && terminal.sandboxId
        && terminal.terminalId
        && owner.sandboxId === terminal.sandboxId
        && owner.terminalId === terminal.terminalId,
    )

const getServerTopicStatus = (
    topic: TdpOperationsTopicSnapshot,
    serverSnapshot?: AdminTdpServerOperationsSnapshot,
): string => {
    if (!serverSnapshot) {
        return '服务端诊断未连接'
    }
    const availableTopics = asServerTopicSet(serverSnapshot)
    if (availableTopics.has(topic.topic)) {
        return '服务端可给'
    }
    if (topic.requiredMissing) {
        return '服务端缺失'
    }
    if (topic.accepted) {
        return 'accepted 但服务端未列出'
    }
    if (topic.requested) {
        return '本地请求但服务端未列出'
    }
    return '服务端未列出'
}

const topicFilterOptions: Array<{
    key: TopicFilter
    title: string
}> = [
    {key: 'all', title: '全部'},
    {key: 'abnormal', title: '异常'},
    {key: 'accepted', title: '已接受'},
    {key: 'rejected', title: '已拒绝'},
    {key: 'required-missing', title: 'Required 缺失'},
    {key: 'local-residual', title: '本地残留'},
    {key: 'local-only', title: '本地请求'},
    {key: 'inactive', title: '未订阅'},
]

const filterTopics = (
    topics: readonly TdpOperationsTopicSnapshot[],
    filter: TopicFilter,
) => topics.filter(topic => {
    if (filter === 'all') {
        return true
    }
    if (filter === 'abnormal') {
        return isAbnormalTopic(topic)
    }
    return topic.status === filter
})

const HashValue: React.FC<{
    value?: string
}> = ({value}) => (
    <Text selectable style={{fontSize: 12, color: '#526072', lineHeight: 18}}>
        {value ?? '未记录'}
    </Text>
)

const InlineDiagnosticMessage: React.FC<{
    message?: string
}> = ({message}) => message ? (
    <View
        testID="ui-base-admin-section:tdp:inline-message"
        style={{
            borderRadius: 12,
            backgroundColor: '#eff6ff',
            paddingHorizontal: 12,
            paddingVertical: 10,
        }}
    >
        <Text style={{color: '#163a74', lineHeight: 20}}>{message}</Text>
    </View>
) : null

const SubTabButton: React.FC<{
    tab: TdpSubTab
    title: string
    selected: boolean
    onPress: (tab: TdpSubTab) => void
}> = ({tab, title, selected, onPress}) => {
    const testID = `ui-base-admin-section:tdp:subtab:${tab}`
    useAdminAutomationNode({
        nodeId: testID,
        testID,
        screenKey: 'ui.base.admin-console.tab.tdp',
        mountId: `admin-action:${testID}`,
        role: 'button',
        text: title,
        value: tab,
        focused: selected,
        availableActions: ['press'],
        onAutomationAction: () => {
            onPress(tab)
            return {ok: true}
        },
    })
    return (
        <Pressable
            testID={testID}
            onPress={() => onPress(tab)}
            style={{
                minHeight: 38,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: selected ? '#0b5fff' : '#bfd2e8',
                backgroundColor: selected ? '#0b5fff' : '#ffffff',
                paddingHorizontal: 12,
                paddingVertical: 8,
                justifyContent: 'center',
            }}
        >
            <Text style={{fontSize: 13, fontWeight: '800', color: selected ? '#ffffff' : '#0f172a'}}>
                {title}
            </Text>
        </Pressable>
    )
}

const FilterButton: React.FC<{
    filter: TopicFilter
    title: string
    selected: boolean
    onPress: (filter: TopicFilter) => void
}> = ({filter, title, selected, onPress}) => {
    const testID = `ui-base-admin-section:tdp:topic-filter:${filter}`
    useAdminAutomationNode({
        nodeId: testID,
        testID,
        screenKey: 'ui.base.admin-console.tab.tdp',
        mountId: `admin-action:${testID}`,
        role: 'button',
        text: title,
        value: filter,
        focused: selected,
        availableActions: ['press'],
        onAutomationAction: () => {
            onPress(filter)
            return {ok: true}
        },
    })
    return (
        <Pressable
            testID={testID}
            onPress={() => onPress(filter)}
            style={{
                minHeight: 34,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: selected ? '#0b5fff' : '#bfd2e8',
                backgroundColor: selected ? '#eff6ff' : '#ffffff',
                paddingHorizontal: 10,
                paddingVertical: 6,
                justifyContent: 'center',
            }}
        >
            <Text style={{fontSize: 12, fontWeight: '800', color: selected ? '#0b5fff' : '#475569'}}>
                {title}
            </Text>
        </Pressable>
    )
}

const TopicRows: React.FC<{
    topics: readonly TdpOperationsTopicSnapshot[]
    serverSnapshot?: AdminTdpServerOperationsSnapshot
}> = ({topics, serverSnapshot}) => {
    if (topics.length === 0) {
        return (
            <AdminSectionMessage message="当前没有本地 requested、accepted、rejected、missing 或 projection topic。" />
        )
    }
    return (
        <AdminPagedList
            items={topics}
            pageSize={8}
            itemLabel="个 Topic"
            testIDPrefix="ui-base-admin-section:tdp:topics"
            resetKey={topics.map(topic => topic.topic).join('|')}
            keyExtractor={topic => topic.topic}
            renderItem={topic => (
                <View
                    testID={`ui-base-admin-section:tdp:topic:${topic.topic}`}
                    style={{
                        borderRadius: 14,
                        borderWidth: 1,
                        borderColor: '#d7e1ec',
                        backgroundColor: '#ffffff',
                        padding: 12,
                        gap: 8,
                    }}
                >
                    <View style={{flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center'}}>
                        <Text selectable style={{fontSize: 14, color: '#0f172a', fontWeight: '800'}}>
                            {topic.topic}
                        </Text>
                        <Text style={{
                            borderRadius: 999,
                            overflow: 'hidden',
                            paddingHorizontal: 8,
                            paddingVertical: 3,
                            fontSize: 11,
                            fontWeight: '800',
                            color: getTopicTone(topic) === 'danger'
                                ? '#b91c1c'
                                : getTopicTone(topic) === 'warn'
                                    ? '#c2410c'
                                    : getTopicTone(topic) === 'ok'
                                        ? '#15803d'
                                        : '#475569',
                            backgroundColor: getTopicTone(topic) === 'danger'
                                ? '#fef2f2'
                                : getTopicTone(topic) === 'warn'
                                    ? '#fff7ed'
                                    : getTopicTone(topic) === 'ok'
                                        ? '#ecfdf5'
                                        : '#f1f5f9',
                        }}
                        >
                            {getTopicStatusLabel(topic)}
                        </Text>
                    </View>
                    <Text style={{fontSize: 12, color: '#526072', lineHeight: 18}}>
                        本地条目 {topic.localEntryCount} · staged {topic.stagedEntryCount} · max revision {formatNumber(topic.maxRevision)}
                    </Text>
                    <Text style={{fontSize: 12, color: '#526072', lineHeight: 18}}>
                        最近 occurredAt：{topic.lastOccurredAt ?? '未记录'} · last applied：{formatAdminTimestamp(topic.activity.lastAppliedAt)} · 服务端能力：{getServerTopicStatus(topic, serverSnapshot)}
                    </Text>
                    <Text style={{fontSize: 12, color: '#526072', lineHeight: 18}}>
                        activity {topic.activity.appliedCount} · recent {formatRate(topic.activity.recentAppliedPerMinute)} · source {formatSource(topic.activity.lastSource)}
                    </Text>
                </View>
            )}
        />
    )
}

const TopicFilterBar: React.FC<{
    selected: TopicFilter
    onChange: (filter: TopicFilter) => void
}> = ({selected, onChange}) => (
    <View style={{flexDirection: 'row', flexWrap: 'wrap', gap: 8}}>
        {topicFilterOptions.map(option => (
            <FilterButton
                key={option.key}
                filter={option.key}
                title={option.title}
                selected={selected === option.key}
                onPress={onChange}
            />
        ))}
    </View>
)

const OverviewTab: React.FC<{
    snapshot: TdpOperationsSnapshot
    terminal: AdminTdpTerminalSnapshot
    serverSnapshot?: AdminTdpServerOperationsSnapshot
}> = ({snapshot, terminal, serverSnapshot}) => {
    const primaryFinding = snapshot.findings[0]
    return (
        <>
            <AdminSummaryGrid>
                <AdminSummaryCard
                    label="会话状态"
                    value={formatAdminStatus(snapshot.session.status)}
                    detail={snapshot.session.sessionId ?? '未建立 session'}
                    tone={getSessionTone(snapshot.session.status)}
                />
                <AdminSummaryCard
                    label="同步模式"
                    value={formatAdminStatus(snapshot.session.syncMode)}
                    detail={snapshot.session.highWatermarkStale ? '基于断连前水位' : '当前会话水位可判断'}
                    tone={snapshot.session.syncMode === 'full' ? 'warn' : 'neutral'}
                />
                <AdminSummaryCard
                    label="游标延迟"
                    value={snapshot.pipeline.canJudgeWatermarkLag ? formatNumber(snapshot.pipeline.watermarkLag) : '不可判定'}
                    detail={snapshot.session.highWatermarkStale ? 'TDP 未 READY，highWatermark 可能是旧值。' : 'highWatermark - lastAppliedCursor'}
                    tone={snapshot.pipeline.canJudgeWatermarkLag && (snapshot.pipeline.watermarkLag ?? 0) > 0 ? 'warn' : 'neutral'}
                />
                <AdminSummaryCard
                    label="Topic 健康"
                    value={`${snapshot.subscription.acceptedTopics.length}/${snapshot.subscription.requestedTopics.length}`}
                    detail={`拒绝 ${snapshot.subscription.rejectedTopics.length}，Required 缺失 ${snapshot.subscription.requiredMissingTopics.length}`}
                    tone={snapshot.subscription.requiredMissingTopics.length > 0
                        ? 'danger'
                        : snapshot.subscription.rejectedTopics.length > 0
                            ? 'warn'
                            : 'ok'}
                />
                <AdminSummaryCard
                    label="本地存储"
                    value={`${snapshot.projection.activeEntryCount} 条`}
                    detail={`topic ${snapshot.projection.topicCount}，过期 ${snapshot.projection.expiredEntryCount}`}
                    tone={snapshot.projection.expiredEntryCount > 0 ? 'warn' : 'neutral'}
                />
                <AdminSummaryCard
                    label="Topic 活动"
                    value={`${snapshot.activity.totalAppliedCount} 次`}
                    detail={`最近 apply：${formatAdminTimestamp(snapshot.activity.lastAppliedAt)}`}
                    tone={snapshot.activity.totalAppliedCount > 0 ? 'ok' : 'neutral'}
                />
                <AdminSummaryCard
                    label="服务端视角"
                    value={serverSnapshot ? '已接入' : '未连接'}
                    detail={serverSnapshot?.sessions?.currentSessionId ?? '服务端 operations snapshot 未加载。'}
                    tone={serverSnapshot ? 'ok' : 'neutral'}
                />
            </AdminSummaryGrid>
            <AdminBlock
                title="Terminal Context"
                description="当前 admin console 所在 runtime/localNode 的终端身份和绑定。"
            >
                <AdminDetailList
                    items={[
                        {key: 'sandboxId', label: 'Sandbox ID', value: terminal.sandboxId},
                        {key: 'terminalId', label: 'Terminal ID', value: terminal.terminalId},
                        {key: 'profileId', label: 'Profile', value: serverSnapshot?.terminal?.profileName ?? serverSnapshot?.terminal?.profileCode ?? terminal.profileId ?? (terminal.terminalId ? '未同步名称' : '未绑定')},
                        {key: 'templateId', label: 'Template', value: serverSnapshot?.terminal?.templateName ?? serverSnapshot?.terminal?.templateCode ?? terminal.templateId ?? (terminal.terminalId ? '未同步名称' : '未绑定')},
                        {key: 'platformId', label: '平台', value: terminal.platformId},
                        {key: 'projectId', label: '项目', value: terminal.projectId},
                        {key: 'brandId', label: '品牌', value: terminal.brandId},
                        {key: 'tenantId', label: '租户', value: terminal.tenantId},
                        {key: 'storeId', label: '门店', value: terminal.storeId},
                    ]}
                />
            </AdminBlock>
            <AdminBlock
                title="问题摘要"
                description="只展示当前最值得先看的排障线索。"
            >
                <AdminStatusList
                    items={snapshot.findings.slice(0, 5).map(finding => ({
                        key: finding.key,
                        label: finding.title,
                        tone: toStatusTone(finding.tone),
                        value: primaryFinding?.key === finding.key ? '优先查看' : undefined,
                        detail: finding.detail,
                    }))}
                />
            </AdminBlock>
        </>
    )
}

const TopicsTab: React.FC<{
    snapshot: TdpOperationsSnapshot
    filter: TopicFilter
    onFilterChange: (filter: TopicFilter) => void
    serverSnapshot?: AdminTdpServerOperationsSnapshot
}> = ({snapshot, filter, onFilterChange, serverSnapshot}) => (
    <>
        <AdminSummaryGrid>
            <AdminSummaryCard label="本地请求" value={`${snapshot.subscription.requestedTopics.length}`} detail="来自本地 requested/active/accepted 订阅视角。" tone="neutral" />
            <AdminSummaryCard label="实际接受" value={`${snapshot.subscription.acceptedTopics.length}`} detail="来自 handshake accepted topics。" tone="ok" />
            <AdminSummaryCard label="服务端可给" value={`${asServerTopicSet(serverSnapshot).size}`} detail={serverSnapshot ? '来自服务端 operations snapshot。' : '服务端诊断未连接。'} tone={serverSnapshot ? 'ok' : 'neutral'} />
            <AdminSummaryCard label="拒绝" value={`${snapshot.subscription.rejectedTopics.length}`} detail={formatList(snapshot.subscription.rejectedTopics)} tone={snapshot.subscription.rejectedTopics.length > 0 ? 'warn' : 'neutral'} />
            <AdminSummaryCard label="Required 缺失" value={`${snapshot.subscription.requiredMissingTopics.length}`} detail={formatList(snapshot.subscription.requiredMissingTopics)} tone={snapshot.subscription.requiredMissingTopics.length > 0 ? 'danger' : 'neutral'} />
        </AdminSummaryGrid>
        <AdminBlock
            title="Topic 协商矩阵"
            description="对比本地 requested、handshake accepted/rejected 和服务端可给 topic。"
        >
            <TopicFilterBar selected={filter} onChange={onFilterChange} />
            <TopicRows topics={filterTopics(snapshot.topics, filter)} serverSnapshot={serverSnapshot} />
        </AdminBlock>
        <AdminBlock
            title="订阅 Hash"
            description="Phase 1 仅比较本地 requested / active / accepted hash。"
        >
            <View style={{gap: 8}}>
                <Text style={{fontSize: 12, color: '#64748b'}}>requested</Text>
                <HashValue value={snapshot.subscription.requestedHash} />
                <Text style={{fontSize: 12, color: '#64748b'}}>active</Text>
                <HashValue value={snapshot.sync.activeSubscriptionHash} />
                <Text style={{fontSize: 12, color: '#64748b'}}>accepted</Text>
                <HashValue value={snapshot.subscription.acceptedHash} />
                <InlineDiagnosticMessage
                    message={snapshot.subscription.localHashMismatch
                        ? '本地 Hash 不一致，可能处于订阅切换或旧 session。'
                        : undefined}
                />
            </View>
        </AdminBlock>
    </>
)

const TopicDetailsTab: React.FC<{
    snapshot: TdpOperationsSnapshot
    filter: TopicFilter
    onFilterChange: (filter: TopicFilter) => void
}> = ({snapshot, filter, onFilterChange}) => {
    const topics = filterTopics(snapshot.topics, filter)
    return (
        <>
            <AdminSummaryGrid>
                <AdminSummaryCard label="总接收" value={`${snapshot.activity.totalReceivedCount}`} detail={`最近接收：${formatAdminTimestamp(snapshot.activity.lastReceivedAt)}`} tone="neutral" />
                <AdminSummaryCard label="总应用" value={`${snapshot.activity.totalAppliedCount}`} detail={`最近应用：${formatAdminTimestamp(snapshot.activity.lastAppliedAt)}`} tone={snapshot.activity.totalAppliedCount > 0 ? 'ok' : 'neutral'} />
                <AdminSummaryCard label="窗口" value={`${Math.round(snapshot.activity.windowSizeMs / 1000)}s`} detail="按最近保留窗口折算每分钟频率。" tone="neutral" />
                <AdminSummaryCard label="热点 Topic" value={`${snapshot.activity.hottestTopics.length}`} detail={snapshot.activity.hottestTopics.map(item => item.topic).join(', ') || '无'} tone="neutral" />
            </AdminSummaryGrid>
            <AdminBlock
                title="Topic 活动明细"
                description="展示本地收到和 apply 的 activity 统计。该统计为 runtime-only，重启后可归零。"
            >
                <TopicFilterBar selected={filter} onChange={onFilterChange} />
                {topics.length === 0 ? (
                    <AdminSectionMessage message="当前筛选条件下没有 topic 活动。" />
                ) : (
                    <AdminPagedList
                        items={topics}
                        pageSize={8}
                        itemLabel="个 Topic"
                        testIDPrefix="ui-base-admin-section:tdp:topic-details"
                        resetKey={topics.map(topic => topic.topic).join('|')}
                        keyExtractor={topic => topic.topic}
                        renderItem={topic => (
                            <View
                                testID={`ui-base-admin-section:tdp:topic-detail:${topic.topic}`}
                                style={{
                                    borderRadius: 14,
                                    borderWidth: 1,
                                    borderColor: '#d7e1ec',
                                    backgroundColor: '#ffffff',
                                    padding: 12,
                                    gap: 8,
                                }}
                            >
                                <Text selectable style={{fontSize: 14, color: '#0f172a', fontWeight: '800'}}>
                                    {topic.topic}
                                </Text>
                                <AdminDetailList
                                    items={[
                                        {key: `${topic.topic}:status`, label: '状态', value: getTopicStatusLabel(topic)},
                                        {key: `${topic.topic}:received`, label: 'received / applied', value: `${topic.activity.receivedCount} / ${topic.activity.appliedCount}`},
                                        {key: `${topic.topic}:source`, label: '来源拆分', value: `snapshot ${topic.activity.snapshotAppliedCount} · changes ${topic.activity.changesAppliedCount} · realtime ${topic.activity.realtimeAppliedCount}`},
                                        {key: `${topic.topic}:rate`, label: '近期频率', value: `${formatRate(topic.activity.recentReceivedPerMinute)} received · ${formatRate(topic.activity.recentAppliedPerMinute)} applied`},
                                        {key: `${topic.topic}:lastReceived`, label: 'lastReceivedAt', value: formatAdminTimestamp(topic.activity.lastReceivedAt)},
                                        {key: `${topic.topic}:lastApplied`, label: 'lastAppliedAt', value: formatAdminTimestamp(topic.activity.lastAppliedAt)},
                                        {key: `${topic.topic}:lastSource`, label: 'lastSource', value: formatSource(topic.activity.lastSource)},
                                        {key: `${topic.topic}:localEntries`, label: 'local/staged/maxRevision', value: `${topic.localEntryCount} / ${topic.stagedEntryCount} / ${formatNumber(topic.maxRevision)}`},
                                    ]}
                                />
                            </View>
                        )}
                    />
                )}
            </AdminBlock>
        </>
    )
}

const PipelineTab: React.FC<{
    snapshot: TdpOperationsSnapshot
}> = ({snapshot}) => (
    <>
        <AdminSummaryGrid>
            <AdminSummaryCard label="Snapshot" value={formatAdminStatus(snapshot.sync.snapshotStatus)} detail={snapshot.pipeline.snapshotProgress ? `${snapshot.pipeline.snapshotProgress.appliedItems}/${snapshot.pipeline.snapshotProgress.totalItems} (${snapshot.pipeline.snapshotProgress.percent}%)` : '未处于可量化 apply'} tone={snapshot.sync.snapshotStatus === 'error' ? 'danger' : snapshot.sync.snapshotStatus === 'applying' ? 'warn' : 'neutral'} />
            <AdminSummaryCard label="Changes" value={formatAdminStatus(snapshot.sync.changesStatus)} detail="增量变更拉取与 apply 状态。" tone={snapshot.sync.changesStatus === 'error' ? 'danger' : snapshot.sync.changesStatus === 'catching-up' ? 'warn' : 'neutral'} />
            <AdminSummaryCard label="ACK 差值" value={formatNumber(snapshot.pipeline.ackLag)} detail="Phase 1 仅展示差值，不直接判错。" tone={snapshot.pipeline.ackLag > 0 ? 'neutral' : 'ok'} />
            <AdminSummaryCard label="Apply 差值" value={formatNumber(snapshot.pipeline.applyLag)} detail="Phase 1 仅展示差值，不直接判错。" tone={snapshot.pipeline.applyLag > 0 ? 'neutral' : 'ok'} />
        </AdminSummaryGrid>
        <AdminBlock title="游标流水线">
            <AdminDetailList
                items={[
                    {key: 'lastCursor', label: 'lastCursor', value: snapshot.sync.lastCursor},
                    {key: 'lastDeliveredCursor', label: 'lastDeliveredCursor', value: snapshot.sync.lastDeliveredCursor},
                    {key: 'lastAckedCursor', label: 'lastAckedCursor', value: snapshot.sync.lastAckedCursor},
                    {key: 'lastAppliedCursor', label: 'lastAppliedCursor', value: snapshot.sync.lastAppliedCursor},
                    {key: 'highWatermark', label: 'highWatermark', value: snapshot.session.highWatermark},
                    {key: 'serverClockOffsetMs', label: 'serverClockOffsetMs', value: snapshot.sync.serverClockOffsetMs},
                ]}
            />
        </AdminBlock>
    </>
)

const StorageTab: React.FC<{
    snapshot: TdpOperationsSnapshot
}> = ({snapshot}) => (
    <>
        <AdminSummaryGrid>
            <AdminSummaryCard label="Active entries" value={`${snapshot.projection.activeEntryCount}`} detail={`buffer ${snapshot.projection.activeBufferId}`} tone="neutral" />
            <AdminSummaryCard label="Staged entries" value={`${snapshot.projection.stagedEntryCount}`} detail={snapshot.projection.stagedBufferId ?? '无 staged buffer'} tone={snapshot.projection.stagedEntryCount > 0 ? 'warn' : 'neutral'} />
            <AdminSummaryCard label="过期条目" value={`${snapshot.projection.expiredEntryCount}`} detail="基于本地防御性过期判断。" tone={snapshot.projection.expiredEntryCount > 0 ? 'warn' : 'neutral'} />
            <AdminSummaryCard label="存储引擎诊断" value="未暴露" detail="Phase 1 未接入 hydration/flush 诊断。" tone="neutral" />
        </AdminSummaryGrid>
        <AdminBlock title="恢复真相源">
            <AdminDetailList
                items={[
                    {key: 'lastCursor', label: 'lastCursor', value: snapshot.sync.lastCursor},
                    {key: 'lastAppliedCursor', label: 'lastAppliedCursor', value: snapshot.sync.lastAppliedCursor},
                    {key: 'activeSubscriptionHash', label: 'activeSubscriptionHash', value: snapshot.sync.activeSubscriptionHash},
                    {key: 'lastRequestedSubscriptionHash', label: 'lastRequestedSubscriptionHash', value: snapshot.sync.lastRequestedSubscriptionHash},
                    {key: 'lastAcceptedSubscriptionHash', label: 'lastAcceptedSubscriptionHash', value: snapshot.sync.lastAcceptedSubscriptionHash},
                    {key: 'serverClockOffsetMs', label: 'serverClockOffsetMs', value: snapshot.sync.serverClockOffsetMs},
                    {key: 'lastExpiredProjectionCleanupAt', label: 'lastExpiredProjectionCleanupAt', value: formatAdminTimestamp(snapshot.sync.lastExpiredProjectionCleanupAt)},
                ]}
            />
        </AdminBlock>
    </>
)

const EventsTab: React.FC<{
    snapshot: TdpOperationsSnapshot
}> = ({snapshot}) => (
    <>
        <AdminBlock title="会话事件">
            <AdminDetailList
                items={[
                    {key: 'status', label: '会话状态', value: formatAdminStatus(snapshot.session.status)},
                    {key: 'sessionId', label: 'sessionId', value: snapshot.session.sessionId},
                    {key: 'nodeId', label: 'nodeId', value: snapshot.session.nodeId},
                    {key: 'nodeState', label: 'nodeState', value: snapshot.session.nodeState},
                    {key: 'connectedAt', label: 'connectedAt', value: formatAdminTimestamp(snapshot.session.connectedAt)},
                    {key: 'lastPongAt', label: 'lastPongAt', value: formatAdminTimestamp(snapshot.session.lastPongAt)},
                    {key: 'reconnectAttempt', label: 'reconnectAttempt', value: snapshot.session.reconnectAttempt},
                    {key: 'disconnectReason', label: 'disconnectReason', value: snapshot.session.disconnectReason},
                ]}
            />
        </AdminBlock>
        <AdminBlock title="控制信号">
            <AdminStatusList
                items={[
                    {
                        key: 'protocol-error',
                        label: '协议错误',
                        tone: snapshot.controlSignals?.lastProtocolError ? 'error' : 'neutral',
                        value: snapshot.controlSignals?.lastProtocolError ? '存在' : '无',
                        detail: snapshot.controlSignals?.lastProtocolError?.message,
                    },
                    {
                        key: 'edge-degraded',
                        label: 'Edge degraded',
                        tone: snapshot.controlSignals?.lastEdgeDegraded ? 'warn' : 'neutral',
                        value: snapshot.controlSignals?.lastEdgeDegraded?.reason ?? '无',
                    },
                    {
                        key: 'rehome-required',
                        label: 'Rehome required',
                        tone: snapshot.controlSignals?.lastRehomeRequired ? 'error' : 'neutral',
                        value: snapshot.controlSignals?.lastRehomeRequired?.reason ?? '无',
                    },
                    {
                        key: 'command-inbox',
                        label: 'Command inbox',
                        tone: snapshot.commandInbox.count > 0 ? 'warn' : 'neutral',
                        value: `${snapshot.commandInbox.count}`,
                        detail: snapshot.commandInbox.latestTopic ? `最近 topic：${snapshot.commandInbox.latestTopic}` : undefined,
                    },
                ]}
            />
        </AdminBlock>
    </>
)

const ServerTab: React.FC<{
    serverSnapshot?: AdminTdpServerOperationsSnapshot
    status: ServerSnapshotStatus
    error?: string
    lastSuccessAt?: number
}> = ({serverSnapshot, status, error, lastSuccessAt}) => {
    if (!serverSnapshot) {
        return (
            <AdminBlock
                title="服务端诊断"
                description="服务端 operations snapshot 通过可选 host tool 拉取。"
            >
                <AdminStatusList
                    items={[
                        {
                            key: 'server-mode',
                            label: '诊断模式',
                            tone: status === 'failed' ? 'error' : 'neutral',
                            value: status === 'failed' ? 'serverDiagnostics: failed' : 'serverDiagnostics: unavailable',
                            detail: error ?? '未加载服务端诊断；本地 TDP 状态仍可独立查看。',
                        },
                    ]}
                />
            </AdminBlock>
        )
    }

    const lastSuccessLabel = formatAdminTimestamp(lastSuccessAt ?? serverSnapshot.sampledAt)
    const diagnosticState = status === 'failed'
        ? 'serverDiagnostics: stale'
        : 'serverDiagnostics: available'
    const diagnosticDetail = status === 'failed'
        ? `${diagnosticState} · 当前展示上次成功快照：${lastSuccessLabel}；最近刷新失败：${error ?? '未知错误'}`
        : `${diagnosticState} · 最近成功刷新：${lastSuccessLabel}；服务端采样：${formatAdminTimestamp(serverSnapshot.sampledAt)}`

    return (
        <>
            <AdminSummaryGrid>
                <AdminSummaryCard
                    label="诊断模式"
                    value="server-enhanced"
                    detail={diagnosticDetail}
                    tone={status === 'failed' ? 'warn' : 'ok'}
                />
                <AdminSummaryCard label="服务端可给" value={`${asServerTopicSet(serverSnapshot).size}`} detail={`registry ${serverSnapshot.topicRegistry?.total ?? 0} topics`} tone="neutral" />
                <AdminSummaryCard label="在线会话" value={`${serverSnapshot.sessions?.onlineSessions?.length ?? 0}`} detail={serverSnapshot.sessions?.currentSessionId ?? '无当前 session'} tone={serverSnapshot.sessions?.currentSessionId ? 'ok' : 'warn'} />
                <AdminSummaryCard label="服务端 Findings" value={`${serverSnapshot.findings?.length ?? 0}`} detail={serverSnapshot.findings?.[0]?.title ?? '未发现服务端异常'} tone={(serverSnapshot.findings?.length ?? 0) > 0 ? 'warn' : 'ok'} />
            </AdminSummaryGrid>
            <AdminBlock title="服务端 Terminal">
                <AdminDetailList
                    items={[
                        {key: 'serverTerminalId', label: 'Terminal ID', value: serverSnapshot.terminal?.terminalId},
                        {key: 'serverProfile', label: 'Profile', value: serverSnapshot.terminal?.profileName ?? serverSnapshot.terminal?.profileCode ?? serverSnapshot.terminal?.profileId},
                        {key: 'serverTemplate', label: 'Template', value: serverSnapshot.terminal?.templateName ?? serverSnapshot.terminal?.templateCode ?? serverSnapshot.terminal?.templateId},
                        {key: 'presenceStatus', label: 'Presence', value: formatAdminStatus(serverSnapshot.terminal?.presenceStatus)},
                        {key: 'healthStatus', label: 'Health', value: formatAdminStatus(serverSnapshot.terminal?.healthStatus)},
                        {key: 'currentAppVersion', label: 'App 版本', value: serverSnapshot.terminal?.currentAppVersion},
                        {key: 'currentBundleVersion', label: 'Bundle 版本', value: serverSnapshot.terminal?.currentBundleVersion},
                        {key: 'lastSeenAt', label: 'lastSeenAt', value: formatAdminTimestamp(serverSnapshot.terminal?.lastSeenAt ?? undefined)},
                    ]}
                />
            </AdminBlock>
            <AdminBlock title="服务端 Session">
                <AdminDetailList
                    items={[
                        {key: 'sessionId', label: 'sessionId', value: serverSnapshot.sessions?.current?.sessionId},
                        {key: 'status', label: 'status', value: formatAdminStatus(serverSnapshot.sessions?.current?.status)},
                        {key: 'highWatermark', label: 'highWatermark', value: serverSnapshot.sessions?.current?.highWatermark},
                        {key: 'ackLag', label: 'ackLag', value: serverSnapshot.sessions?.current?.ackLag},
                        {key: 'applyLag', label: 'applyLag', value: serverSnapshot.sessions?.current?.applyLag},
                        {key: 'connectedAt', label: 'connectedAt', value: formatAdminTimestamp(serverSnapshot.sessions?.current?.connectedAt)},
                        {key: 'lastHeartbeatAt', label: 'lastHeartbeatAt', value: formatAdminTimestamp(serverSnapshot.sessions?.current?.lastHeartbeatAt)},
                    ]}
                />
            </AdminBlock>
            <AdminBlock title="Policy 与 Decision">
                <AdminStatusList
                    items={[
                        {
                            key: 'policySources',
                            label: 'Policy sources',
                            tone: (serverSnapshot.policy?.policySources?.length ?? 0) > 0 ? 'ok' : 'neutral',
                            value: `${serverSnapshot.policy?.policySources?.length ?? 0}`,
                            detail: serverSnapshot.policy?.policySources?.join(', ') || '未暴露 allowlist 来源',
                        },
                        {
                            key: 'allowedTopics',
                            label: 'Allowed topics',
                            tone: (serverSnapshot.policy?.allowedTopics?.length ?? 0) > 0 ? 'ok' : 'neutral',
                            value: `${serverSnapshot.policy?.allowedTopics?.length ?? 0}`,
                            detail: formatList(serverSnapshot.policy?.allowedTopics),
                        },
                        {
                            key: 'decisionTopics',
                            label: 'Decision topics',
                            tone: (serverSnapshot.decisionTrace?.topics?.length ?? 0) > 0 ? 'ok' : 'neutral',
                            value: `${serverSnapshot.decisionTrace?.topics?.length ?? 0}`,
                            detail: serverSnapshot.decisionTrace?.topics?.slice(0, 3).map(item => item.topicKey).join(', ') || '无',
                        },
                    ]}
                />
            </AdminBlock>
            <AdminBlock title="服务端告警">
                <AdminStatusList
                    pageSize={6}
                    testIDPrefix="ui-base-admin-section:tdp:server-findings"
                    items={(serverSnapshot.findings ?? []).length > 0
                        ? (serverSnapshot.findings ?? []).map(finding => ({
                            key: finding.key,
                            label: finding.title,
                            tone: finding.tone,
                            detail: finding.detail,
                        }))
                        : [{
                            key: 'server-findings-empty',
                            label: '服务端诊断',
                            tone: 'ok',
                            value: '无异常',
                        }]}
                />
            </AdminBlock>
            {serverSnapshot.decisionTrace?.topics?.length ? (
                <AdminBlock
                    title="Decision Trace 样本"
                    description="服务端决策明细按 JSON 分页展示，避免一次性渲染大量候选项。"
                >
                    <AdminPagedText
                        value={JSON.stringify(serverSnapshot.decisionTrace.topics, null, 2)}
                        pageSize={5_000}
                        testIDPrefix="ui-base-admin-section:tdp:decision-trace"
                    />
                </AdminBlock>
            ) : null}
        </>
    )
}

const buildDiagnosticSummary = (
    snapshot: TdpOperationsSnapshot,
    terminal: AdminTdpTerminalSnapshot,
    activeTab: TdpSubTab,
    topicFilter: TopicFilter,
    serverStatus: ServerSnapshotStatus,
    lastServerSuccessAt?: number,
    serverError?: string,
    serverSnapshot?: AdminTdpServerOperationsSnapshot,
) => JSON.stringify({
    mode: serverSnapshot ? 'server-enhanced' : 'local-only',
    serverDiagnostics: serverSnapshot
        ? serverStatus === 'failed' ? 'stale' : 'available'
        : serverStatus === 'failed' ? 'failed' : 'unavailable',
    serverStatus,
    lastServerSuccessAt,
    serverError,
    sampledAt: new Date().toISOString(),
    activeTab,
    topicFilter,
    terminal,
    session: snapshot.session,
    subscription: snapshot.subscription,
    pipeline: snapshot.pipeline,
    projection: snapshot.projection,
    activity: snapshot.activity,
    findings: snapshot.findings,
    server: serverSnapshot,
    topicCount: snapshot.topics.length,
    topics: snapshot.topics.slice(0, 80).map(topic => ({
        topic: topic.topic,
        status: topic.status,
        requested: topic.requested,
        accepted: topic.accepted,
        rejected: topic.rejected,
        requiredMissing: topic.requiredMissing,
        localEntryCount: topic.localEntryCount,
        stagedEntryCount: topic.stagedEntryCount,
        maxRevision: topic.maxRevision,
        lastOccurredAt: topic.lastOccurredAt,
        activity: topic.activity,
    })),
    topicsTruncated: snapshot.topics.length > 80,
}, null, 2)

const readTdpAdminSnapshot = (state: ReturnType<EnhancedStore['getState']>) => {
    const identity = selectTcpIdentitySnapshot(state)
    const binding = selectTcpBindingSnapshot(state)
    return {
        terminal: {
            sandboxId: selectTcpSandboxId(state),
            terminalId: identity.terminalId,
            profileId: binding.profileId,
            templateId: binding.templateId,
            platformId: binding.platformId,
            projectId: binding.projectId,
            brandId: binding.brandId,
            tenantId: binding.tenantId,
            storeId: binding.storeId,
        } satisfies AdminTdpTerminalSnapshot,
        tdp: selectTdpOperationsSnapshot(state),
    }
}

export const AdminTdpSection: React.FC<AdminTdpSectionProps> = ({store, host}) => {
    const [activeTab, setActiveTab] = useState<TdpSubTab>('overview')
    const [topicFilter, setTopicFilter] = useState<TopicFilter>('all')
    const [diagnosticSummary, setDiagnosticSummary] = useState<string | undefined>(undefined)
    const [serverSnapshot, setServerSnapshot] = useState<AdminTdpServerOperationsSnapshot | undefined>(undefined)
    const [serverSnapshotOwner, setServerSnapshotOwner] = useState<ServerSnapshotOwner | undefined>(undefined)
    const [serverStatus, setServerStatus] = useState<ServerSnapshotStatus>(host ? 'idle' : 'unavailable')
    const [serverError, setServerError] = useState<string | undefined>(undefined)
    const [lastServerSuccessAt, setLastServerSuccessAt] = useState<number | undefined>(undefined)
    const readSnapshot = useCallback(() => readTdpAdminSnapshot(store.getState()), [store])
    const snapshot = useAdminStoreSnapshot(
        store.subscribe,
        readSnapshot,
        shallowEqualAdminSnapshot,
    )
    const {tdp, terminal} = snapshot
    const serverSnapshotMatchesCurrentTerminal = isServerSnapshotOwnerCurrent(serverSnapshotOwner, terminal)
    const currentServerSnapshot = serverSnapshotMatchesCurrentTerminal ? serverSnapshot : undefined
    const currentServerStatus = serverSnapshotMatchesCurrentTerminal ? serverStatus : host ? 'idle' : 'unavailable'
    const currentServerError = serverSnapshotMatchesCurrentTerminal ? serverError : undefined
    const currentLastServerSuccessAt = serverSnapshotMatchesCurrentTerminal ? lastServerSuccessAt : undefined
    const topFindingTone = useMemo(() => toSummaryTone(tdp.findings[0]?.tone ?? 'neutral'), [tdp.findings])
    useEffect(() => {
        if (!serverSnapshotOwner || serverSnapshotMatchesCurrentTerminal) {
            return
        }
        setDiagnosticSummary(undefined)
        setServerSnapshot(undefined)
        setServerSnapshotOwner(undefined)
        setServerStatus(host ? 'idle' : 'unavailable')
        setServerError(undefined)
        setLastServerSuccessAt(undefined)
    }, [host, serverSnapshotMatchesCurrentTerminal, serverSnapshotOwner])
    const refreshServerSnapshot = useCallback(async () => {
        if (!host) {
            setDiagnosticSummary(undefined)
            setServerSnapshot(undefined)
            setServerSnapshotOwner(undefined)
            setServerStatus('unavailable')
            setServerError('当前 host 未提供 TDP 服务端诊断能力。')
            setLastServerSuccessAt(undefined)
            return
        }
        if (!terminal.sandboxId || !terminal.terminalId) {
            setDiagnosticSummary(undefined)
            setServerSnapshot(undefined)
            setServerSnapshotOwner(undefined)
            setServerStatus('failed')
            setServerError('缺少 sandboxId 或 terminalId，无法请求服务端诊断。')
            setLastServerSuccessAt(undefined)
            return
        }
        const requestOwner = {
            sandboxId: terminal.sandboxId,
            terminalId: terminal.terminalId,
        }
        setDiagnosticSummary(undefined)
        setServerStatus('loading')
        setServerError(undefined)
        try {
            const nextSnapshot = await host.getOperationsSnapshot({
                sandboxId: requestOwner.sandboxId,
                terminalId: requestOwner.terminalId,
            })
            setServerSnapshot(nextSnapshot)
            setServerSnapshotOwner(requestOwner)
            setLastServerSuccessAt(Date.now())
            setServerStatus('ready')
        } catch (error) {
            setServerStatus('failed')
            setServerError(error instanceof Error ? error.message : '服务端诊断读取失败')
        }
    }, [host, terminal.sandboxId, terminal.terminalId])
    const inlineMessage = useMemo(() => {
        if (diagnosticSummary) {
            return `诊断摘要已生成：${diagnosticSummary.length} 字符`
        }
        if (currentServerStatus === 'ready') {
            return `服务端诊断已刷新：${formatAdminTimestamp(currentLastServerSuccessAt)}`
        }
        if (currentServerStatus === 'loading' && currentServerSnapshot) {
            return `服务端诊断刷新中；继续展示上次成功快照：${formatAdminTimestamp(currentLastServerSuccessAt ?? currentServerSnapshot.sampledAt)}`
        }
        if (currentServerStatus === 'failed') {
            const reason = currentServerError ?? '未知错误'
            if (currentServerSnapshot) {
                return `服务端诊断失败：${reason}；继续展示上次成功快照：${formatAdminTimestamp(currentLastServerSuccessAt ?? currentServerSnapshot.sampledAt)}`
            }
            return `服务端诊断失败：${reason}`
        }
        return undefined
    }, [
        currentLastServerSuccessAt,
        currentServerError,
        currentServerSnapshot,
        currentServerStatus,
        diagnosticSummary,
    ])

    return (
        <AdminSectionShell
            testID="ui-base-admin-section:tdp"
            title="TDP 数据平面"
            description="查看终端本地 TDP 会话、Topic 协商、同步流水线、本地存储和告警。"
        >
            <AdminSectionMessage message={tdp.findings[0]?.title} />
            <AdminSummaryGrid>
                <AdminSummaryCard
                    label="排障摘要"
                    value={tdp.findings[0]?.title ?? '未发现异常'}
                    detail={tdp.findings[0]?.detail}
                    tone={topFindingTone}
                />
            </AdminSummaryGrid>
            <AdminActionGroup>
                <AdminActionButton
                    testID="ui-base-admin-section:tdp:copy-diagnostics"
                    label="复制诊断摘要"
                    tone="secondary"
                    onPress={() => {
                        setDiagnosticSummary(buildDiagnosticSummary(
                            tdp,
                            terminal,
                            activeTab,
                            topicFilter,
                            currentServerStatus,
                            currentLastServerSuccessAt,
                            currentServerError,
                            currentServerSnapshot,
                        ))
                    }}
                />
                <AdminActionButton
                    testID="ui-base-admin-section:tdp:refresh-server"
                    label={serverStatus === 'loading' ? '刷新中' : '刷新服务端诊断'}
                    tone="secondary"
                    disabled={serverStatus === 'loading'}
                    onPress={refreshServerSnapshot}
                />
            </AdminActionGroup>
            <InlineDiagnosticMessage
                message={inlineMessage}
            />
            <View style={{flexDirection: 'row', flexWrap: 'wrap', gap: 8}}>
                {subTabs.map(tab => (
                    <SubTabButton
                        key={tab.key}
                        tab={tab.key}
                        title={tab.title}
                        selected={activeTab === tab.key}
                        onPress={setActiveTab}
                    />
                ))}
            </View>
            {activeTab === 'overview' ? <OverviewTab snapshot={tdp} terminal={terminal} serverSnapshot={currentServerSnapshot} /> : null}
            {activeTab === 'topics' ? <TopicsTab snapshot={tdp} filter={topicFilter} onFilterChange={setTopicFilter} serverSnapshot={currentServerSnapshot} /> : null}
            {activeTab === 'topicDetails' ? <TopicDetailsTab snapshot={tdp} filter={topicFilter} onFilterChange={setTopicFilter} /> : null}
            {activeTab === 'pipeline' ? <PipelineTab snapshot={tdp} /> : null}
            {activeTab === 'storage' ? <StorageTab snapshot={tdp} /> : null}
            {activeTab === 'events' ? <EventsTab snapshot={tdp} /> : null}
            {activeTab === 'server' ? (
                <ServerTab
                    serverSnapshot={currentServerSnapshot}
                    status={currentServerStatus}
                    error={currentServerError}
                    lastSuccessAt={currentLastServerSuccessAt}
                />
            ) : null}
        </AdminSectionShell>
    )
}
