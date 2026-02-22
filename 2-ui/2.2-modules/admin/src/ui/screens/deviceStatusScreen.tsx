import React, {useEffect, useState} from "react";
import {ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View} from "react-native";
import {DeviceInfo, ScreenMode, ScreenPartRegistration, SystemStatus, device} from "@impos2/kernel-core-base";
import {uiAdminVariables} from "../variables";
import {InstanceMode, Workspace} from "@impos2/kernel-core-interconnection";

// ─── Design Tokens ───────────────────────────────────────────────────────────
const C = {
    bg: '#F0F2F5',
    surface: '#FFFFFF',
    border: '#E2E8F0',
    text: '#0F172A',
    textSub: '#64748B',
    textMuted: '#94A3B8',
    accent: '#0369A1',
    accentBg: '#EFF6FF',
    ok: '#16A34A',
    okBg: '#F0FDF4',
    warn: '#D97706',
    warnBg: '#FFFBEB',
    err: '#DC2626',
    errBg: '#FEF2F2',
    divider: '#F1F5F9',
} as const;

// ─── Helpers ─────────────────────────────────────────────────────────────────
const Row: React.FC<{ label: string; value?: string | number | null; mono?: boolean }> = ({label, value, mono}) => (
    <View style={s.row}>
        <Text style={s.rowLabel}>{label}</Text>
        <Text style={[s.rowValue, mono && s.mono]} numberOfLines={1} ellipsizeMode="tail">
            {value ?? '—'}
        </Text>
    </View>
);

const Badge: React.FC<{ text: string; color: string; bg: string }> = ({text, color, bg}) => (
    <View style={[s.badge, {backgroundColor: bg}]}>
        <Text style={[s.badgeText, {color}]}>{text}</Text>
    </View>
);

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({title, children}) => (
    <View style={s.section}>
        <Text style={s.sectionTitle}>{title}</Text>
        <View style={s.card}>{children}</View>
    </View>
);

const BarRow: React.FC<{ label: string; value: number; unit?: string; warn?: number; err?: number }> = (
    {label, value, unit = '%', warn = 70, err = 90}
) => {
    const color = value >= err ? C.err : value >= warn ? C.warn : C.ok;
    return (
        <View style={s.barRow}>
            <View style={s.barHeader}>
                <Text style={s.rowLabel}>{label}</Text>
                <Text style={[s.barValue, {color}]}>{value.toFixed(1)}{unit}</Text>
            </View>
            <View style={s.barTrack}>
                <View style={[s.barFill, {width: `${Math.min(value, 100)}%` as any, backgroundColor: color}]}/>
            </View>
        </View>
    );
};

// ─── Peripheral Tabs ─────────────────────────────────────────────────────────
type PeripheralTab = 'usb' | 'bluetooth' | 'serial' | 'apps';

const PeripheralSection: React.FC<{ status: SystemStatus }> = ({status}) => {
    const [tab, setTab] = useState<PeripheralTab>('usb');

    const tabs: { key: PeripheralTab; label: string; count: number }[] = [
        {key: 'usb', label: 'USB', count: status.usbDevices.length},
        {key: 'bluetooth', label: '蓝牙', count: status.bluetoothDevices.length},
        {key: 'serial', label: '串口', count: status.serialDevices.length},
        {key: 'apps', label: '应用', count: status.installedApps.length},
    ];

    return (
        <Section title="外设">
            {/* Tab Bar */}
            <View style={s.tabBar}>
                {tabs.map((t, i) => {
                    const active = tab === t.key;
                    return (
                        <TouchableOpacity
                            key={t.key}
                            style={[s.tabItem, active && s.tabItemActive, i < tabs.length - 1 && s.tabItemBorder]}
                            onPress={() => setTab(t.key)}
                            activeOpacity={0.7}
                        >
                            <Text style={[s.tabLabel, active && s.tabLabelActive]}>{t.label}</Text>
                            <View style={[s.tabBadge, active && s.tabBadgeActive]}>
                                <Text style={[s.tabBadgeText, active && s.tabBadgeTextActive]}>{t.count}</Text>
                            </View>
                        </TouchableOpacity>
                    );
                })}
            </View>

            {/* Tab Content */}
            <View style={s.tabContent}>
                {tab === 'usb' && (
                    status.usbDevices.length === 0 ? <EmptyHint/> :
                        status.usbDevices.map((d, i) => (
                            <React.Fragment key={d.deviceId}>
                                {i > 0 && <View style={s.divider}/>}
                                <Row label={d.name} value={d.deviceClass}/>
                                <View style={s.subRow}>
                                    <Text style={s.subText}>VID: {d.vendorId}  PID: {d.productId}  ID: {d.deviceId}</Text>
                                </View>
                            </React.Fragment>
                        ))
                )}
                {tab === 'bluetooth' && (
                    status.bluetoothDevices.length === 0 ? <EmptyHint/> :
                        status.bluetoothDevices.map((d, i) => (
                            <React.Fragment key={d.address}>
                                {i > 0 && <View style={s.divider}/>}
                                <View style={s.row}>
                                    <View style={{flex: 1}}>
                                        <Text style={s.rowValue2}>{d.name}</Text>
                                        <Text style={s.subText}>{d.address}  ·  {d.type.toUpperCase()}{d.rssi != null ? `  ·  ${d.rssi} dBm` : ''}</Text>
                                    </View>
                                    <Badge
                                        text={d.connected ? '已连接' : '未连接'}
                                        color={d.connected ? C.ok : C.textMuted}
                                        bg={d.connected ? C.okBg : C.divider}
                                    />
                                </View>
                            </React.Fragment>
                        ))
                )}
                {tab === 'serial' && (
                    status.serialDevices.length === 0 ? <EmptyHint/> :
                        status.serialDevices.map((d, i) => (
                            <React.Fragment key={d.path}>
                                {i > 0 && <View style={s.divider}/>}
                                <View style={s.row}>
                                    <View style={{flex: 1}}>
                                        <Text style={s.rowValue2}>{d.name}</Text>
                                        <Text style={s.subText}>{d.path}{d.baudRate ? `  ·  ${d.baudRate} baud` : ''}</Text>
                                    </View>
                                    <Badge
                                        text={d.isOpen ? '已打开' : '未打开'}
                                        color={d.isOpen ? C.ok : C.textMuted}
                                        bg={d.isOpen ? C.okBg : C.divider}
                                    />
                                </View>
                            </React.Fragment>
                        ))
                )}
                {tab === 'apps' && (
                    status.installedApps.length === 0 ? <EmptyHint/> :
                        status.installedApps.map((a, i) => (
                            <React.Fragment key={a.packageName}>
                                {i > 0 && <View style={s.divider}/>}
                                <View style={s.row}>
                                    <View style={{flex: 1}}>
                                        <Text style={s.rowValue2}>{a.appName}</Text>
                                        <Text style={s.subText}>{a.packageName}  ·  v{a.versionName}</Text>
                                    </View>
                                    {a.isSystemApp && <Badge text="系统" color={C.accent} bg={C.accentBg}/>}
                                </View>
                            </React.Fragment>
                        ))
                )}
            </View>
        </Section>
    );
};

const EmptyHint: React.FC = () => (
    <View style={s.emptyHint}>
        <Text style={s.emptyHintText}>暂无设备</Text>
    </View>
);

// ─── Component ───────────────────────────────────────────────────────────────
export const DeviceStatusScreen: React.FC = () => {
    const [deviceInfo, setDeviceInfo] = useState<DeviceInfo | null>(null);
    const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        Promise.all([device.getDeviceInfo(), device.getSystemStatus()])
            .then(([info, status]) => {
                setDeviceInfo(info);
                setSystemStatus(status);
            })
            .finally(() => setLoading(false));
    }, []);

    if (loading) {
        return (
            <View style={s.center}>
                <ActivityIndicator size="large" color={C.accent}/>
                <Text style={s.loadingText}>正在读取系统信息…</Text>
            </View>
        );
    }

    const ts = systemStatus ? new Date(systemStatus.updateAt).toLocaleString('zh-CN') : '—';

    return (
        <ScrollView style={s.root} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>

            {/* Header */}
            <View style={s.header}>
                <Text style={s.headerTitle}>系统状态</Text>
                <Text style={s.headerSub}>采集时间：{ts}</Text>
            </View>

            {/* ── 设备信息 ── */}
            {deviceInfo && (
                <Section title="设备信息">
                    <Row label="设备 ID" value={deviceInfo.id} mono/>
                    <View style={s.divider}/>
                    <Row label="制造商" value={deviceInfo.manufacturer}/>
                    <View style={s.divider}/>
                    <Row label="操作系统" value={`${deviceInfo.os}  ${deviceInfo.osVersion}`}/>
                    <View style={s.divider}/>
                    <Row label="CPU" value={deviceInfo.cpu}/>
                    <View style={s.divider}/>
                    <Row label="内存" value={deviceInfo.memory}/>
                    <View style={s.divider}/>
                    <Row label="存储" value={deviceInfo.disk}/>
                    <View style={s.divider}/>
                    <Row label="网卡" value={deviceInfo.network}/>
                </Section>
            )}

            {/* ── 显示器 ── */}
            {deviceInfo?.displays?.length ? (
                <Section title={`显示器（${deviceInfo.displays.length}）`}>
                    {deviceInfo.displays.map((d, i) => (
                        <React.Fragment key={d.id}>
                            {i > 0 && <View style={s.divider}/>}
                            <View style={s.displayRow}>
                                <View style={s.displayIndex}>
                                    <Text style={s.displayIndexText}>{i + 1}</Text>
                                </View>
                                <View style={s.displayInfo}>
                                    <Text style={s.displayType}>{d.displayType}</Text>
                                    <Text style={s.displaySpec}>
                                        {d.width}×{d.height}px · {d.physicalWidth}×{d.physicalHeight}cm · {d.refreshRate}Hz
                                        {d.touchSupport ? ' · 触控' : ''}
                                    </Text>
                                </View>
                            </View>
                        </React.Fragment>
                    ))}
                </Section>
            ) : null}

            {/* ── 资源占用 ── */}
            {systemStatus && (
                <Section title="资源占用">
                    <BarRow label={`CPU（${systemStatus.cpu.cores} 核）`} value={systemStatus.cpu.app}/>
                    <View style={s.divider}/>
                    <BarRow
                        label={`内存  ${systemStatus.memory.app} MB / ${systemStatus.memory.total} MB`}
                        value={systemStatus.memory.appPercentage}
                    />
                    <View style={s.divider}/>
                    <BarRow
                        label={`磁盘  ${systemStatus.disk.used.toFixed(1)} GB / ${systemStatus.disk.total.toFixed(1)} GB`}
                        value={systemStatus.disk.overall}
                    />
                </Section>
            )}

            {/* ── 网络 ── */}
            {systemStatus?.networks?.length ? (
                <Section title={`网络（${systemStatus.networks.length}）`}>
                    {systemStatus.networks.map((n, i) => (
                        <React.Fragment key={`${n.name}-${i}`}>
                            {i > 0 && <View style={s.divider}/>}
                            <View style={s.netRow}>
                                <View style={s.netLeft}>
                                    <Text style={s.netName}>{n.name}</Text>
                                    <Text style={s.netType}>{n.type.toUpperCase()}</Text>
                                </View>
                                <View style={s.netRight}>
                                    <Badge
                                        text={n.connected ? '已连接' : '未连接'}
                                        color={n.connected ? C.ok : C.err}
                                        bg={n.connected ? C.okBg : C.errBg}
                                    />
                                    {n.connected && <Text style={s.netIp}>{n.ipAddress}</Text>}
                                </View>
                            </View>
                        </React.Fragment>
                    ))}
                </Section>
            ) : null}

            {/* ── 外设 ── */}
            {systemStatus && <PeripheralSection status={systemStatus}/>}

        </ScrollView>
    );
};

// ─── Styles ──────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
    root: {flex: 1, backgroundColor: C.bg},
    content: {padding: 20, paddingBottom: 40},
    center: {flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12},
    loadingText: {fontSize: 14, color: C.textSub},

    header: {marginBottom: 20},
    headerTitle: {fontSize: 22, fontWeight: '700', color: C.text, letterSpacing: -0.3},
    headerSub: {fontSize: 12, color: C.textMuted, marginTop: 4},

    section: {marginBottom: 16},
    sectionTitle: {fontSize: 11, fontWeight: '600', color: C.textMuted, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 8, marginLeft: 2},
    card: {backgroundColor: C.surface, borderRadius: 12, borderWidth: 1, borderColor: C.border, overflow: 'hidden'},

    row: {flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12},
    rowLabel: {fontSize: 13, color: C.textSub, flex: 1},
    rowValue: {fontSize: 13, color: C.text, fontWeight: '500', flex: 2, textAlign: 'right'},
    mono: {fontFamily: 'monospace', fontSize: 12},
    divider: {height: 1, backgroundColor: C.divider, marginHorizontal: 16},
    badge: {paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6},
    badgeText: {fontSize: 11, fontWeight: '600'},

    barRow: {paddingHorizontal: 16, paddingVertical: 12},
    barHeader: {flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8},
    barValue: {fontSize: 13, fontWeight: '600'},
    barTrack: {height: 6, backgroundColor: C.divider, borderRadius: 3, overflow: 'hidden'},
    barFill: {height: 6, borderRadius: 3},

    displayRow: {flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 12},
    displayIndex: {width: 28, height: 28, borderRadius: 8, backgroundColor: C.accentBg, justifyContent: 'center', alignItems: 'center'},
    displayIndexText: {fontSize: 13, fontWeight: '700', color: C.accent},
    displayInfo: {flex: 1},
    displayType: {fontSize: 13, fontWeight: '500', color: C.text},
    displaySpec: {fontSize: 11, color: C.textMuted, marginTop: 2},

    netRow: {flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12},
    netLeft: {flex: 1},
    netName: {fontSize: 13, fontWeight: '500', color: C.text},
    netType: {fontSize: 11, color: C.textMuted, marginTop: 2},
    netRight: {alignItems: 'flex-end', gap: 4},
    netIp: {fontSize: 11, color: C.textSub, fontFamily: 'monospace'},

    peripheralGrid: {flexDirection: 'row'},
    peripheralItem: {flex: 1, alignItems: 'center', paddingVertical: 16},
    peripheralCount: {fontSize: 24, fontWeight: '700', color: C.text},
    peripheralLabel: {fontSize: 11, color: C.textMuted, marginTop: 4},

    tabBar: {flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: C.border},
    tabItem: {flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, gap: 6},
    tabItemActive: {borderBottomWidth: 2, borderBottomColor: C.accent},
    tabItemBorder: {borderRightWidth: 1, borderRightColor: C.border},
    tabLabel: {fontSize: 13, color: C.textSub, fontWeight: '500'},
    tabLabelActive: {color: C.accent, fontWeight: '600'},
    tabBadge: {paddingHorizontal: 6, paddingVertical: 1, borderRadius: 10, backgroundColor: C.divider},
    tabBadgeActive: {backgroundColor: C.accentBg},
    tabBadgeText: {fontSize: 11, color: C.textMuted, fontWeight: '600'},
    tabBadgeTextActive: {color: C.accent},
    tabContent: {paddingBottom: 4},

    rowValue2: {fontSize: 13, color: C.text, fontWeight: '500'},
    subRow: {paddingHorizontal: 16, paddingBottom: 10},
    subText: {fontSize: 11, color: C.textMuted, fontFamily: 'monospace'},
    emptyHint: {paddingVertical: 24, alignItems: 'center'},
    emptyHintText: {fontSize: 13, color: C.textMuted},
});

// ─── Registration ─────────────────────────────────────────────────────────────
export const deviceStatusScreenPart: ScreenPartRegistration = {
    name: 'deviceStatusScreenPart',
    title: '系统状态',
    description: '当前系统信息',
    partKey: 'system.admin.device.status',
    containerKey: uiAdminVariables.systemAdminPanel.key,
    screenMode: [ScreenMode.DESKTOP, ScreenMode.MOBILE],
    instanceMode: [InstanceMode.MASTER],
    workspace: [Workspace.MAIN],
    componentType: DeviceStatusScreen,
    indexInContainer: 0,
};
