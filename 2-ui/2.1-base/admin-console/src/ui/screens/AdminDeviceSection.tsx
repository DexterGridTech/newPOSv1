import React, {useCallback, useState} from 'react'
import type {AdminDeviceHost, AdminDeviceSnapshot} from '../../types'
import {
    AdminBlock,
    AdminActionButton,
    AdminDetailList,
    AdminSectionMessage,
    AdminSectionShell,
    AdminSectionUnavailable,
    AdminStatusList,
    AdminSummaryCard,
    AdminSummaryGrid,
} from './AdminSectionPrimitives'
import {
    useAdminMountedRef,
    useAdminRefreshWhileScreenActive,
} from './useAdminScreenActivity'

const readString = (
    value: unknown,
): string | undefined => {
    if (typeof value === 'string' && value.trim()) {
        return value
    }
    if (typeof value === 'number' || typeof value === 'boolean') {
        return `${value}`
    }
    return undefined
}

const formatResourceRows = (
    items: readonly Record<string, unknown>[],
    formatItem: (item: Record<string, unknown>, index: number) => {
        title: string
        description?: string
        status?: string
    },
) => items.map((item, index) => {
    const formatted = formatItem(item, index)
    return {
        key: `${formatted.title}:${index}`,
        label: formatted.title,
        value: formatted.status ?? '已识别',
        detail: formatted.description,
        tone: 'neutral' as const,
    }
})

export interface AdminDeviceSectionProps {
    host?: AdminDeviceHost
}

export const AdminDeviceSection: React.FC<AdminDeviceSectionProps> = ({
    host,
}) => {
    const mountedRef = useAdminMountedRef()
    const [snapshot, setSnapshot] = useState<AdminDeviceSnapshot | undefined>()
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)
    const resourceDetails = snapshot?.resourceDetails

    const refresh = useCallback((errorMessage: string) => {
        if (!host) {
            return
        }
        void (async () => {
            setLoading(true)
            setError('')
            try {
                const nextSnapshot = await host.getSnapshot()
                if (mountedRef.current) {
                    setSnapshot(nextSnapshot)
                }
            } catch (nextError) {
                if (mountedRef.current) {
                    setError(nextError instanceof Error ? nextError.message : errorMessage)
                }
            } finally {
                if (mountedRef.current) {
                    setLoading(false)
                }
            }
        })()
    }, [host, mountedRef])

    useAdminRefreshWhileScreenActive(
        () => refresh('设备信息刷新失败'),
        host ? 'host-ready' : 'host-missing',
    )

    if (!host) {
        return (
            <AdminSectionUnavailable
                testID="ui-base-admin-section:device"
                title="设备与宿主"
                message="设备宿主能力未安装"
            />
        )
    }

    return (
        <AdminSectionShell
            testID="ui-base-admin-section:device"
            title="设备与宿主"
            description="查看当前终端的设备身份、宿主环境和运行信息。"
        >
            <AdminActionButton
                testID="ui-base-admin-section:device:refresh"
                label={loading ? '刷新中' : '刷新设备与宿主信息'}
                tone="primary"
                disabled={loading}
                onPress={() => refresh('设备信息刷新失败')}
            />
            <AdminSectionMessage message={error || undefined} />
            {snapshot ? (
                <>
                    <AdminSummaryGrid>
                        <AdminSummaryCard
                            label="身份项"
                            value={`${snapshot.identity.length}`}
                            detail="设备 ID、平台、型号等基础身份信息。"
                            tone="primary"
                        />
                        <AdminSummaryCard
                            label="运行项"
                            value={`${snapshot.runtime.length}`}
                            detail="宿主环境、系统资源和采集指标。"
                            tone="neutral"
                        />
                        <AdminSummaryCard
                            label="资源概览"
                            value={`${snapshot.peripherals?.length ?? 0}`}
                            detail="USB、蓝牙、串口、网络、应用等可枚举资源摘要。"
                            tone={(snapshot.peripherals?.length ?? 0) > 0 ? 'ok' : 'neutral'}
                        />
                    </AdminSummaryGrid>
                    <AdminBlock
                        title="设备身份"
                        description="终端自身的身份与基础设备描述。"
                    >
                        <AdminDetailList items={snapshot.identity} />
                    </AdminBlock>
                    <AdminBlock
                        title="宿主运行信息"
                        description="宿主环境和系统运行时采集结果。"
                    >
                        <AdminDetailList items={snapshot.runtime} />
                    </AdminBlock>
                    {snapshot.peripherals?.length ? (
                        <AdminBlock
                            title="资源摘要"
                            description="当前宿主可枚举到的外设与资源数量摘要。"
                        >
                            <AdminStatusList items={snapshot.peripherals} />
                        </AdminBlock>
                    ) : null}
                    {resourceDetails?.usbDevices?.length ? (
                        <AdminBlock
                            title="USB 设备"
                            description="当前宿主识别到的 USB 设备。"
                        >
                            <AdminStatusList
                                items={formatResourceRows(resourceDetails.usbDevices, (item, index) => ({
                                    title: readString(item.name) ?? `USB 设备 ${index + 1}`,
                                    status: readString(item.deviceClass) ?? '已识别',
                                    description: [
                                        readString(item.deviceId),
                                        readString(item.vendorId) ? `VID ${readString(item.vendorId)}` : undefined,
                                        readString(item.productId) ? `PID ${readString(item.productId)}` : undefined,
                                    ].filter(Boolean).join(' · '),
                                }))}
                            />
                        </AdminBlock>
                    ) : null}
                    {resourceDetails?.bluetoothDevices?.length ? (
                        <AdminBlock
                            title="蓝牙设备"
                            description="蓝牙扫描结果与当前连接状态。"
                        >
                            <AdminStatusList
                                items={formatResourceRows(resourceDetails.bluetoothDevices, (item, index) => ({
                                    title: readString(item.name) ?? `蓝牙设备 ${index + 1}`,
                                    status: item.connected === true ? '已连接' : '未连接',
                                    description: readString(item.address),
                                }))}
                            />
                        </AdminBlock>
                    ) : null}
                    {resourceDetails?.serialDevices?.length ? (
                        <AdminBlock
                            title="串口设备"
                            description="串口路径、波特率和打开状态。"
                        >
                            <AdminStatusList
                                items={formatResourceRows(resourceDetails.serialDevices, (item, index) => ({
                                    title: readString(item.name) ?? `串口设备 ${index + 1}`,
                                    status: item.isOpen === true ? '已打开' : '未打开',
                                    description: [
                                        readString(item.path),
                                        readString(item.baudRate) ? `${readString(item.baudRate)} baud` : undefined,
                                    ].filter(Boolean).join(' · '),
                                }))}
                            />
                        </AdminBlock>
                    ) : null}
                    {resourceDetails?.networks?.length ? (
                        <AdminBlock
                            title="网络连接"
                            description="当前宿主报告的网络接口与地址。"
                        >
                            <AdminStatusList
                                items={formatResourceRows(resourceDetails.networks, (item, index) => ({
                                    title: readString(item.name) ?? readString(item.type) ?? `网络 ${index + 1}`,
                                    status: readString(item.status) ?? '已识别',
                                    description: [
                                        readString(item.ipAddress),
                                        readString(item.macAddress),
                                        readString(item.ssid),
                                    ].filter(Boolean).join(' · '),
                                }))}
                            />
                        </AdminBlock>
                    ) : null}
                    {resourceDetails?.installedApps?.length ? (
                        <AdminBlock
                            title="已安装应用"
                            description="宿主枚举到的本机应用，用于确认业务依赖是否安装齐全。"
                        >
                            <AdminStatusList
                                items={formatResourceRows(resourceDetails.installedApps.slice(0, 12), (item, index) => ({
                                    title: readString(item.appName) ?? `应用 ${index + 1}`,
                                    status: item.isSystemApp === true ? '系统应用' : '普通应用',
                                    description: [
                                        readString(item.packageName),
                                        readString(item.versionName) ? `v${readString(item.versionName)}` : undefined,
                                    ].filter(Boolean).join(' · '),
                                }))}
                            />
                        </AdminBlock>
                    ) : null}
                </>
            ) : null}
        </AdminSectionShell>
    )
}
