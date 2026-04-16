import React, {useEffect, useState} from 'react'
import type {
    AdminConnectorChannelSnapshot,
    AdminConnectorHost,
    AdminConnectorProbeResult,
} from '../../types'
import {getAdminHostTools} from '../../supports/adminHostToolsRegistry'
import {
    AdminActionButton,
    AdminBlock,
    AdminSectionMessage,
    AdminSectionShell,
    AdminSectionUnavailable,
    AdminSummaryCard,
    AdminSummaryGrid,
} from './AdminSectionPrimitives'

export interface AdminConnectorSectionProps {
    host?: AdminConnectorHost
}

export const AdminConnectorSection: React.FC<AdminConnectorSectionProps> = ({
    host = getAdminHostTools().connector,
}) => {
    const [channels, setChannels] = useState<readonly AdminConnectorChannelSnapshot[]>([])
    const [results, setResults] = useState<Record<string, AdminConnectorProbeResult>>({})
    const [message, setMessage] = useState('')
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        if (!host) {
            return
        }
        void (async () => {
            setLoading(true)
            setMessage('')
            try {
                setChannels(await host.getChannels())
            } catch (error) {
                setMessage(error instanceof Error ? error.message : '连接器能力读取失败')
            } finally {
                setLoading(false)
            }
        })()
    }, [host])

    if (!host) {
        return (
            <AdminSectionUnavailable
                testID="ui-base-admin-section:connector"
                title="连接器调试"
                message="连接器宿主能力未安装"
            />
        )
    }

    const handleRefresh = () => {
        void (async () => {
            setLoading(true)
            setMessage('')
            try {
                setChannels(await host.getChannels())
            } catch (error) {
                setMessage(error instanceof Error ? error.message : '连接器能力刷新失败')
            } finally {
                setLoading(false)
            }
        })()
    }

    const handleProbe = (channelKey: string) => {
        void (async () => {
            setLoading(true)
            setMessage('')
            try {
                const result = await host.probe(channelKey)
                setResults(current => ({
                    ...current,
                    [channelKey]: result,
                }))
            } catch (error) {
                setMessage(error instanceof Error ? error.message : '连接器探测失败')
            } finally {
                setLoading(false)
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
                onPress={handleRefresh}
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
            {channels.map(channel => (
                <AdminBlock
                    key={channel.key}
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
                </AdminBlock>
            ))}
        </AdminSectionShell>
    )
}
