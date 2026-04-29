import React, {useCallback, useState} from 'react'
import type {
    AdminConnectorChannelSnapshot,
    AdminConnectorHost,
    AdminConnectorProbeResult,
} from '../../types'
import {
    AdminActionButton,
    AdminBlock,
    AdminSectionMessage,
    AdminSectionShell,
    AdminSectionUnavailable,
    AdminSummaryCard,
    AdminSummaryGrid,
    AdminDetailList,
    AdminPagedList,
} from './AdminSectionPrimitives'
import {
    useAdminMountedRef,
    useAdminRefreshWhileScreenActive,
} from './useAdminScreenActivity'

export interface AdminConnectorSectionProps {
    host?: AdminConnectorHost
}

export const AdminConnectorSection: React.FC<AdminConnectorSectionProps> = ({
    host,
}) => {
    const mountedRef = useAdminMountedRef()
    const [channels, setChannels] = useState<readonly AdminConnectorChannelSnapshot[]>([])
    const [results, setResults] = useState<Record<string, AdminConnectorProbeResult>>({})
    const [message, setMessage] = useState('')
    const [loading, setLoading] = useState(false)

    const refresh = useCallback((errorMessage: string) => {
        if (!host) {
            return
        }
        void (async () => {
            setLoading(true)
            setMessage('')
            try {
                const nextChannels = await host.getChannels()
                if (mountedRef.current) {
                    setChannels(nextChannels)
                }
            } catch (error) {
                if (mountedRef.current) {
                    setMessage(error instanceof Error ? error.message : errorMessage)
                }
            } finally {
                if (mountedRef.current) {
                    setLoading(false)
                }
            }
        })()
    }, [host, mountedRef])

    useAdminRefreshWhileScreenActive(
        () => refresh('连接器能力刷新失败'),
        host ? 'host-ready' : 'host-missing',
    )

    if (!host) {
        return (
            <AdminSectionUnavailable
                testID="ui-base-admin-section:connector"
                title="连接器调试"
                message="连接器宿主能力未安装"
            />
        )
    }

    const handleProbe = (channelKey: string) => {
        void (async () => {
            setLoading(true)
            setMessage('')
            try {
                const result = await host.probe(channelKey)
                if (mountedRef.current) {
                    setResults(current => ({
                        ...current,
                        [channelKey]: result,
                    }))
                }
            } catch (error) {
                if (mountedRef.current) {
                    setMessage(error instanceof Error ? error.message : '连接器探测失败')
                }
            } finally {
                if (mountedRef.current) {
                    setLoading(false)
                }
            }
        })()
    }

    return (
        <AdminSectionShell
            testID="ui-base-admin-section:connector"
            title="连接器调试"
            description="查看当前已安装的连接器通道，并对通道做可用性探测。"
        >
            <AdminActionButton
                testID="ui-base-admin-section:connector:refresh"
                label={loading ? '刷新中' : '刷新连接器'}
                tone="primary"
                disabled={loading}
                onPress={() => refresh('连接器能力刷新失败')}
            />
            <AdminSectionMessage message={message || undefined} />
            <AdminSummaryGrid>
                <AdminSummaryCard
                    label="连接器数量"
                    value={`${channels.length}`}
                    detail="当前宿主注册并可供探测的连接器通道。"
                    tone={channels.length > 0 ? 'ok' : 'warn'}
                />
            </AdminSummaryGrid>
            <AdminPagedList
                items={channels}
                pageSize={6}
                itemLabel="个通道"
                testIDPrefix="ui-base-admin-section:connector:channels"
                emptyMessage="当前没有可探测的连接器通道。"
                keyExtractor={channel => channel.key}
                renderItem={channel => (
                    <AdminBlock
                        title={channel.title}
                        description={channel.detail ?? '该通道可用于连接器能力探测。'}
                    >
                        <AdminSummaryGrid>
                            <AdminSummaryCard
                                label="通道标识"
                                value={channel.key}
                                detail="连接器内部唯一标识。"
                                tone="primary"
                            />
                            <AdminSummaryCard
                                label="目标"
                                value={channel.target ?? '未提供'}
                                detail="当前宿主识别到的通道目标。"
                                tone={channel.target ? 'neutral' : 'warn'}
                            />
                            <AdminSummaryCard
                                label="最近探测"
                                value={results[channel.key]?.message ?? '未执行'}
                                detail="最近一次连接器探测结果。"
                                tone={
                                    results[channel.key]?.tone === 'error'
                                        ? 'danger'
                                        : results[channel.key]?.tone === 'warn'
                                            ? 'warn'
                                            : results[channel.key]?.tone === 'ok'
                                                ? 'ok'
                                                : 'neutral'
                                }
                            />
                        </AdminSummaryGrid>
                        <AdminActionButton
                            testID={`ui-base-admin-section:connector:probe:${channel.key}`}
                            label="执行探测"
                            disabled={loading}
                            onPress={() => handleProbe(channel.key)}
                        />
                        {results[channel.key] ? (
                            <AdminDetailList
                                items={[
                                    {
                                        key: `${channel.key}:probe-message`,
                                        label: '探测消息',
                                        value: results[channel.key]?.message,
                                    },
                                ]}
                            />
                        ) : null}
                    </AdminBlock>
                )}
            />
        </AdminSectionShell>
    )
}
