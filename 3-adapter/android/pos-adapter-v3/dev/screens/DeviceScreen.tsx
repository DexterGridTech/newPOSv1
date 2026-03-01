import React, {useState, useCallback, useEffect, useRef} from 'react'
import {
    View, Text, ScrollView, Pressable, StyleSheet,
    ActivityIndicator, FlatList,
} from 'react-native'
import {device} from '@impos2/kernel-core-base'
import type {DeviceInfo, SystemStatus, PowerStatusChangeEvent} from '@impos2/kernel-core-base'
import {C} from '../theme'

type Tab = 'info' | 'status' | 'power'

const TABS: {key: Tab; label: string}[] = [
    {key: 'info', label: '设备信息'},
    {key: 'status', label: '系统状态'},
    {key: 'power', label: '电源监听'},
]

export default function DeviceScreen() {
    const [tab, setTab] = useState<Tab>('info')
    return (
        <View style={s.root}>
            <View style={s.header}>
                <View>
                    <Text style={s.headerTitle}>Device Monitor</Text>
                    <Text style={s.headerSubtitle}>实时设备状态监控</Text>
                </View>
                <View style={s.tabs}>
                    {TABS.map(t => (
                        <Pressable
                            key={t.key}
                            style={({pressed}) => [
                                s.tab,
                                tab === t.key && s.tabActive,
                                pressed && s.tabPressed
                            ]}
                            onPress={() => setTab(t.key)}
                        >
                            <Text style={[s.tabText, tab === t.key && s.tabTextActive]}>{t.label}</Text>
                        </Pressable>
                    ))}
                </View>
            </View>
            {tab === 'info' && <InfoPanel />}
            {tab === 'status' && <StatusPanel />}
            {tab === 'power' && <PowerPanel />}
        </View>
    )
}

// ─── Info Panel ───────────────────────────────────────────────────────────────

function InfoPanel() {
    const [data, setData] = useState<DeviceInfo | null>(null)
    const [loading, setLoading] = useState(true)
    const [err, setErr] = useState<string | null>(null)

    const load = useCallback(async () => {
        setLoading(true); setErr(null)
        try { setData(await device.getDeviceInfo()) }
        catch (e: any) { setErr(e?.message ?? String(e)) }
        finally { setLoading(false) }
    }, [])

    useEffect(() => { load() }, [load])

    return (
        <ScrollView style={s.panel} contentContainerStyle={{paddingBottom: 32}}>
            {loading && (
                <View style={s.loadingContainer}>
                    <ActivityIndicator size="large" color={C.accent} />
                    <Text style={s.loadingText}>正在读取设备信息...</Text>
                </View>
            )}

            {err && (
                <View style={s.errorCard}>
                    <Text style={s.errorTitle}>⚠️ 加载失败</Text>
                    <Text style={s.errorText}>{err}</Text>
                    <Pressable
                        style={({pressed}) => [s.retryBtn, pressed && s.retryBtnPressed]}
                        onPress={load}
                    >
                        <Text style={s.retryBtnText}>重试</Text>
                    </Pressable>
                </View>
            )}

            {data && (
                <>
                    <MetricCard title="基本信息" icon="📱">
                        <InfoRow label="设备 ID" value={data.id} />
                        <InfoRow label="制造商" value={data.manufacturer} />
                        <InfoRow label="操作系统" value={`${data.os} ${data.osVersion}`} />
                    </MetricCard>

                    <MetricCard title="硬件配置" icon="⚙️">
                        <InfoRow label="CPU" value={data.cpu} />
                        <InfoRow label="内存" value={data.memory} />
                        <InfoRow label="磁盘" value={data.disk} />
                        <InfoRow label="网络" value={data.network} />
                    </MetricCard>

                    <MetricCard title={`显示器 (${data.displays.length})`} icon="🖥️">
                        {data.displays.map((d, i) => (
                            <View key={i} style={s.displayCard}>
                                <View style={s.displayHeader}>
                                    <Text style={s.displayTitle}>{d.displayType}</Text>
                                    <StatusBadge status={d.touchSupport ? 'success' : 'muted'} label={d.touchSupport ? '触摸' : '无触摸'} />
                                </View>
                                <InfoRow label="分辨率" value={`${d.width} × ${d.height}`} small />
                                <InfoRow label="刷新率" value={`${d.refreshRate} Hz`} small />
                                <InfoRow label="物理尺寸" value={`${d.physicalWidth} × ${d.physicalHeight} mm`} small />
                            </View>
                        ))}
                    </MetricCard>
                </>
            )}
        </ScrollView>
    )
}

// ─── Status Panel ─────────────────────────────────────────────────────────────

function StatusPanel() {
    const [data, setData] = useState<SystemStatus | null>(null)
    const [loading, setLoading] = useState(true)
    const [err, setErr] = useState<string | null>(null)

    const load = useCallback(async () => {
        setLoading(true); setErr(null)
        try { setData(await device.getSystemStatus()) }
        catch (e: any) { setErr(e?.message ?? String(e)) }
        finally { setLoading(false) }
    }, [])

    useEffect(() => { load() }, [load])

    return (
        <ScrollView style={s.panel} contentContainerStyle={{paddingBottom: 32}}>
            {loading && (
                <View style={s.loadingContainer}>
                    <ActivityIndicator size="large" color={C.accent} />
                    <Text style={s.loadingText}>正在读取系统状态...</Text>
                </View>
            )}

            {err && (
                <View style={s.errorCard}>
                    <Text style={s.errorTitle}>⚠️ 加载失败</Text>
                    <Text style={s.errorText}>{err}</Text>
                    <Pressable
                        style={({pressed}) => [s.retryBtn, pressed && s.retryBtnPressed]}
                        onPress={load}
                    >
                        <Text style={s.retryBtnText}>重试</Text>
                    </Pressable>
                </View>
            )}

            {data && (
                <>
                    <MetricCard title="CPU" icon="🔥">
                        <InfoRow label="核心数" value={String(data.cpu.cores)} />
                        <ProgressRow label="App 占用" value={data.cpu.app} unit="%" />
                    </MetricCard>

                    <MetricCard title="内存" icon="💾">
                        <InfoRow label="总量" value={`${data.memory.total.toFixed(0)} MB`} />
                        <ProgressRow
                            label="App 占用"
                            value={data.memory.appPercentage}
                            unit="%"
                            subtitle={`${data.memory.app.toFixed(0)} MB`}
                        />
                    </MetricCard>

                    <MetricCard title="磁盘" icon="💿">
                        <InfoRow label="总量" value={`${data.disk.total.toFixed(1)} GB`} />
                        <InfoRow label="已用" value={`${data.disk.used.toFixed(1)} GB`} />
                        <InfoRow label="可用" value={`${data.disk.available.toFixed(1)} GB`} />
                        <ProgressRow label="使用率" value={data.disk.overall} unit="%" />
                        <InfoRow label="App 占用" value={`${data.disk.app.toFixed(1)} MB`} />
                    </MetricCard>

                    <MetricCard title="电源" icon="🔋">
                        <View style={s.powerHeader}>
                            <StatusBadge
                                status={data.power.powerConnected ? 'success' : 'danger'}
                                label={data.power.powerConnected ? '电源已连接' : '电源未连接'}
                            />
                            <StatusBadge
                                status={data.power.isCharging ? 'success' : 'muted'}
                                label={data.power.isCharging ? '充电中' : '未充电'}
                            />
                        </View>
                        <ProgressRow label="电量" value={data.power.batteryLevel} unit="%" />
                        <InfoRow label="状态" value={data.power.batteryStatus} />
                        <InfoRow label="健康" value={data.power.batteryHealth} />
                    </MetricCard>

                    {data.usbDevices.length > 0 && (
                        <MetricCard title={`USB 设备 (${data.usbDevices.length})`} icon="🔌">
                            {data.usbDevices.map((d, i) => (
                                <View key={i} style={s.deviceItem}>
                                    <Text style={s.deviceName}>{d.name}</Text>
                                    <Text style={s.deviceDetail}>ID: {d.deviceId}</Text>
                                    <Text style={s.deviceDetail}>VID/PID: {d.vendorId} / {d.productId}</Text>
                                </View>
                            ))}
                        </MetricCard>
                    )}

                    {data.bluetoothDevices.length > 0 && (
                        <MetricCard title={`蓝牙设备 (${data.bluetoothDevices.length})`} icon="📡">
                            {data.bluetoothDevices.map((d, i) => (
                                <View key={i} style={s.deviceItem}>
                                    <View style={s.deviceHeader}>
                                        <Text style={s.deviceName}>{d.name}</Text>
                                        <StatusBadge
                                            status={d.connected ? 'success' : 'muted'}
                                            label={d.connected ? '已连接' : '未连接'}
                                        />
                                    </View>
                                    <Text style={s.deviceDetail}>{d.address} · {d.type}</Text>
                                    {d.rssi != null && <Text style={s.deviceDetail}>信号: {d.rssi} dBm</Text>}
                                </View>
                            ))}
                        </MetricCard>
                    )}

                    {data.serialDevices.length > 0 && (
                        <MetricCard title={`串口设备 (${data.serialDevices.length})`} icon="🔗">
                            {data.serialDevices.map((d, i) => (
                                <View key={i} style={s.deviceItem}>
                                    <View style={s.deviceHeader}>
                                        <Text style={s.deviceName}>{d.name}</Text>
                                        <StatusBadge
                                            status={d.isOpen ? 'success' : 'muted'}
                                            label={d.isOpen ? '已打开' : '未打开'}
                                        />
                                    </View>
                                    <Text style={s.deviceDetail}>{d.path}</Text>
                                    {d.baudRate != null && <Text style={s.deviceDetail}>波特率: {d.baudRate}</Text>}
                                </View>
                            ))}
                        </MetricCard>
                    )}

                    {data.networks.length > 0 && (
                        <MetricCard title={`网络 (${data.networks.length})`} icon="🌐">
                            {data.networks.map((n, i) => (
                                <View key={i} style={s.deviceItem}>
                                    <View style={s.deviceHeader}>
                                        <Text style={s.deviceName}>{n.type}</Text>
                                        {n.signalStrength != null && (
                                            <StatusBadge
                                                status={n.signalStrength > 70 ? 'success' : n.signalStrength > 40 ? 'warn' : 'danger'}
                                                label={`${n.signalStrength}%`}
                                            />
                                        )}
                                    </View>
                                    <Text style={s.deviceDetail}>{n.name}</Text>
                                    <Text style={s.deviceDetail}>IP: {n.ipAddress}</Text>
                                    {n.gateway && <Text style={s.deviceDetail}>网关: {n.gateway}</Text>}
                                    {n.carrier && <Text style={s.deviceDetail}>运营商: {n.carrier}</Text>}
                                </View>
                            ))}
                        </MetricCard>
                    )}

                    {data.installedApps.length > 0 && (
                        <MetricCard title={`已安装应用 (${data.installedApps.length})`} icon="📦">
                            {data.installedApps.slice(0, 5).map((app, i) => (
                                <View key={i} style={s.deviceItem}>
                                    <View style={s.deviceHeader}>
                                        <Text style={s.deviceName}>{app.appName}</Text>
                                        {app.isSystemApp && <StatusBadge status="info" label="系统" />}
                                    </View>
                                    <Text style={s.deviceDetail}>{app.packageName}</Text>
                                    <Text style={s.deviceDetail}>版本: {app.versionName} ({app.versionCode})</Text>
                                </View>
                            ))}
                            {data.installedApps.length > 5 && (
                                <Text style={s.moreText}>还有 {data.installedApps.length - 5} 个应用...</Text>
                            )}
                        </MetricCard>
                    )}
                </>
            )}
        </ScrollView>
    )
}

// ─── Power Panel ──────────────────────────────────────────────────────────────

function PowerPanel() {
    const [listening, setListening] = useState(false)
    const [events, setEvents] = useState<(PowerStatusChangeEvent & {id: string})[]>([])
    const removeRef = useRef<(() => void) | null>(null)

    const toggle = useCallback(() => {
        if (listening) {
            removeRef.current?.()
            removeRef.current = null
            setListening(false)
            setEvents([])
        } else {
            const remove = device.addPowerStatusChangeListener(e => {
                setEvents(prev => [{...e, id: String(Date.now())}, ...prev].slice(0, 30))
            })
            removeRef.current = remove
            setListening(true)
        }
    }, [listening])

    useEffect(() => () => { removeRef.current?.() }, [])

    return (
        <View style={s.panel}>
            <Pressable
                style={({pressed}) => [
                    s.actionBtn,
                    listening && s.actionBtnDanger,
                    pressed && s.actionBtnPressed
                ]}
                onPress={toggle}
            >
                <Text style={s.actionBtnText}>
                    {listening ? '⏸ 停止监听' : '▶️ 开始监听'}
                </Text>
            </Pressable>

            {listening && (
                <View style={s.listeningBanner}>
                    <View style={s.pulsingDot} />
                    <Text style={s.listeningText}>实时监听电源状态变化...</Text>
                    <Text style={s.eventCount}>{events.length} 条事件</Text>
                </View>
            )}

            <FlatList
                data={events}
                keyExtractor={i => i.id}
                style={{marginTop: 12}}
                renderItem={({item}) => (
                    <View style={s.eventCard}>
                        <View style={s.eventHeader}>
                            <View style={[
                                s.eventIndicator,
                                {backgroundColor: item.powerConnected ? C.success : C.danger}
                            ]} />
                            <Text style={s.eventTitle}>
                                {item.powerConnected ? '电源已连接' : '电源已断开'}
                            </Text>
                            <Text style={s.eventTime}>
                                {new Date(item.timestamp).toLocaleTimeString()}
                            </Text>
                        </View>
                        <View style={s.eventBody}>
                            <EventDetail label="电量" value={`${item.batteryLevel}%`} />
                            <EventDetail label="状态" value={item.batteryStatus} />
                            <EventDetail label="充电" value={item.isCharging ? '是' : '否'} />
                        </View>
                    </View>
                )}
                ListEmptyComponent={
                    <View style={s.emptyState}>
                        <Text style={s.emptyIcon}>📊</Text>
                        <Text style={s.emptyText}>暂无事件</Text>
                        <Text style={s.emptyHint}>点击"开始监听"以捕获电源状态变化</Text>
                    </View>
                }
            />
        </View>
    )
}

// ─── Shared Components ────────────────────────────────────────────────────────

function MetricCard({title, icon, children}: {title: string; icon: string; children: React.ReactNode}) {
    return (
        <View style={s.metricCard}>
            <View style={s.metricHeader}>
                <Text style={s.metricIcon}>{icon}</Text>
                <Text style={s.metricTitle}>{title}</Text>
            </View>
            <View style={s.metricBody}>{children}</View>
        </View>
    )
}

function InfoRow({label, value, small}: {label: string; value: string; small?: boolean}) {
    return (
        <View style={s.infoRow}>
            <Text style={[s.infoLabel, small && s.infoLabelSm]}>{label}</Text>
            <Text style={[s.infoValue, small && s.infoValueSm]} numberOfLines={2}>{value}</Text>
        </View>
    )
}

function ProgressRow({label, value, unit, subtitle}: {label: string; value: number; unit: string; subtitle?: string}) {
    const percentage = Math.min(Math.max(value, 0), 100)
    const color = percentage > 80 ? C.progressDanger : percentage > 60 ? C.progressWarn : C.progressSuccess

    return (
        <View style={s.progressRow}>
            <View style={s.progressHeader}>
                <Text style={s.progressLabel}>{label}</Text>
                <Text style={s.progressValue}>{value.toFixed(1)}{unit}</Text>
            </View>
            <View style={s.progressTrack}>
                <View style={[s.progressFill, {width: `${percentage}%`, backgroundColor: color}]} />
            </View>
            {subtitle && <Text style={s.progressSubtitle}>{subtitle}</Text>}
        </View>
    )
}

function StatusBadge({status, label}: {status: 'success' | 'warn' | 'danger' | 'info' | 'muted'; label: string}) {
    const colors = {
        success: {bg: C.successBg, text: C.success},
        warn: {bg: C.warnBg, text: C.warn},
        danger: {bg: C.dangerBg, text: C.danger},
        info: {bg: C.infoBg, text: C.info},
        muted: {bg: C.bgSub, text: C.textMuted},
    }
    const {bg, text} = colors[status]

    return (
        <View style={[s.badge, {backgroundColor: bg}]}>
            <Text style={[s.badgeText, {color: text}]}>{label}</Text>
        </View>
    )
}

function EventDetail({label, value}: {label: string; value: string}) {
    return (
        <View style={s.eventDetail}>
            <Text style={s.eventDetailLabel}>{label}</Text>
            <Text style={s.eventDetailValue}>{value}</Text>
        </View>
    )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
    root: {
        flex: 1,
        backgroundColor: C.bgPage,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: C.border,
        backgroundColor: C.bgCard,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: C.textPrimary,
        letterSpacing: -0.5,
    },
    headerSubtitle: {
        fontSize: 12,
        color: C.textMuted,
        marginTop: 2,
    },
    tabs: {
        flexDirection: 'row',
        backgroundColor: C.bgSub,
        borderRadius: 8,
        padding: 3,
    },
    tab: {
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: 6,
    },
    tabActive: {
        backgroundColor: C.bgCard,
        shadowColor: '#000',
        shadowOffset: {width: 0, height: 1},
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
    },
    tabPressed: {
        opacity: 0.7,
    },
    tabText: {
        fontSize: 12,
        color: C.textMuted,
        fontWeight: '500',
    },
    tabTextActive: {
        color: C.textPrimary,
        fontWeight: '600',
    },
    panel: {
        flex: 1,
        padding: 16,
    },
    actionBtn: {
        backgroundColor: C.accent,
        borderRadius: 10,
        paddingVertical: 14,
        alignItems: 'center',
        shadowColor: C.accent,
        shadowOffset: {width: 0, height: 2},
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 2,
    },
    actionBtnDanger: {
        backgroundColor: C.danger,
        shadowColor: C.danger,
    },
    actionBtnPressed: {
        opacity: 0.8,
        transform: [{scale: 0.98}],
    },
    actionBtnText: {
        color: C.textInverse,
        fontWeight: '700',
        fontSize: 15,
        letterSpacing: 0.3,
    },
    loadingContainer: {
        alignItems: 'center',
        paddingVertical: 32,
    },
    loadingText: {
        marginTop: 12,
        fontSize: 13,
        color: C.textSecondary,
    },
    errorCard: {
        backgroundColor: C.dangerBg,
        borderRadius: 10,
        padding: 16,
        marginTop: 16,
        borderLeftWidth: 4,
        borderLeftColor: C.danger,
    },
    errorTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: C.danger,
        marginBottom: 6,
    },
    errorText: {
        fontSize: 12,
        color: C.danger,
        lineHeight: 18,
        marginBottom: 12,
    },
    retryBtn: {
        backgroundColor: C.danger,
        borderRadius: 8,
        paddingVertical: 10,
        paddingHorizontal: 16,
        alignSelf: 'flex-start',
    },
    retryBtnPressed: {
        opacity: 0.7,
    },
    retryBtnText: {
        color: C.textInverse,
        fontSize: 13,
        fontWeight: '600',
    },
    metricCard: {
        backgroundColor: C.bgCard,
        borderRadius: 12,
        padding: 16,
        marginTop: 16,
        borderWidth: 1,
        borderColor: C.border,
        shadowColor: '#000',
        shadowOffset: {width: 0, height: 1},
        shadowOpacity: 0.03,
        shadowRadius: 3,
        elevation: 1,
    },
    metricHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
        paddingBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: C.border,
    },
    metricIcon: {
        fontSize: 20,
        marginRight: 8,
    },
    metricTitle: {
        fontSize: 15,
        fontWeight: '600',
        color: C.textPrimary,
        letterSpacing: -0.3,
    },
    metricBody: {
        gap: 10,
    },
    infoRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 6,
    },
    infoLabel: {
        fontSize: 13,
        color: C.textSecondary,
        flex: 1,
    },
    infoLabelSm: {
        fontSize: 12,
    },
    infoValue: {
        fontSize: 13,
        color: C.textPrimary,
        fontWeight: '500',
        flex: 2,
        textAlign: 'right',
    },
    infoValueSm: {
        fontSize: 12,
    },
    progressRow: {
        paddingVertical: 4,
    },
    progressHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 6,
    },
    progressLabel: {
        fontSize: 13,
        color: C.textSecondary,
    },
    progressValue: {
        fontSize: 13,
        fontWeight: '600',
        color: C.textPrimary,
    },
    progressTrack: {
        height: 8,
        backgroundColor: C.progressBg,
        borderRadius: 4,
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        borderRadius: 4,
    },
    progressSubtitle: {
        fontSize: 11,
        color: C.textMuted,
        marginTop: 4,
    },
    powerHeader: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 8,
    },
    badge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
    },
    badgeText: {
        fontSize: 11,
        fontWeight: '600',
        letterSpacing: 0.2,
    },
    displayCard: {
        backgroundColor: C.bgSub,
        borderRadius: 8,
        padding: 12,
        marginTop: 8,
    },
    displayHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    displayTitle: {
        fontSize: 13,
        fontWeight: '600',
        color: C.textPrimary,
    },
    deviceItem: {
        backgroundColor: C.bgSub,
        borderRadius: 8,
        padding: 12,
        marginTop: 8,
    },
    deviceHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 6,
    },
    deviceName: {
        fontSize: 13,
        fontWeight: '600',
        color: C.textPrimary,
        flex: 1,
    },
    deviceDetail: {
        fontSize: 11,
        color: C.textSecondary,
        marginTop: 2,
    },
    moreText: {
        fontSize: 12,
        color: C.textMuted,
        textAlign: 'center',
        marginTop: 8,
        fontStyle: 'italic',
    },
    listeningBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: C.successBg,
        borderRadius: 8,
        padding: 12,
        marginTop: 12,
        gap: 8,
    },
    pulsingDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: C.success,
    },
    listeningText: {
        flex: 1,
        fontSize: 13,
        color: C.success,
        fontWeight: '500',
    },
    eventCount: {
        fontSize: 12,
        fontWeight: '700',
        color: C.success,
        backgroundColor: C.bgCard,
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 10,
    },
    eventCard: {
        backgroundColor: C.bgCard,
        borderRadius: 10,
        padding: 12,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: C.border,
    },
    eventHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
        gap: 8,
    },
    eventIndicator: {
        width: 12,
        height: 12,
        borderRadius: 6,
    },
    eventTitle: {
        flex: 1,
        fontSize: 14,
        fontWeight: '600',
        color: C.textPrimary,
    },
    eventTime: {
        fontSize: 11,
        color: C.textMuted,
    },
    eventBody: {
        flexDirection: 'row',
        gap: 16,
    },
    eventDetail: {
        flex: 1,
    },
    eventDetailLabel: {
        fontSize: 10,
        color: C.textMuted,
        marginBottom: 2,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    eventDetailValue: {
        fontSize: 13,
        fontWeight: '500',
        color: C.textPrimary,
    },
    emptyState: {
        alignItems: 'center',
        paddingVertical: 48,
    },
    emptyIcon: {
        fontSize: 48,
        marginBottom: 12,
        opacity: 0.5,
    },
    emptyText: {
        fontSize: 14,
        color: C.textSecondary,
        fontWeight: '500',
        marginBottom: 4,
    },
    emptyHint: {
        fontSize: 12,
        color: C.textMuted,
        textAlign: 'center',
    },
})

