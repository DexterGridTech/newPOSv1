import React, {useCallback, useEffect, useState} from "react";
import {ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View} from "react-native";
import {ScreenMode, ScreenPartRegistration} from "@impos2/kernel-core-base";
import {
    InstanceMode,
    LocalWebServerInfo,
    LocalWebServerStatus,
    ServerConnectionStatus,
    ServerStats,
    Workspace,
    localWebServer,
} from "@impos2/kernel-core-interconnection";
import {uiAdminVariables} from "../variables";
import {useLocalServerStatus} from "../../hooks/useLocalServerStatus";

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
        <Text style={[s.rowValue, mono && s.mono]} numberOfLines={1} ellipsizeMode="tail">{value ?? '—'}</Text>
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

// ─── Utils ────────────────────────────────────────────────────────────────────
const formatUptime = (ms: number): string => {
    if (ms <= 0) return '—';
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const h = Math.floor(m / 60);
    if (h > 0) return `${h}h ${m % 60}m`;
    if (m > 0) return `${m}m ${s % 60}s`;
    return `${s}s`;
};

const serverStatusLabel: Record<LocalWebServerStatus, string> = {
    [LocalWebServerStatus.STOPPED]: '已停止',
    [LocalWebServerStatus.STARTING]: '启动中',
    [LocalWebServerStatus.RUNNING]: '运行中',
    [LocalWebServerStatus.STOPPING]: '停止中',
    [LocalWebServerStatus.ERROR]: '错误',
};

const connStatusLabel: Record<ServerConnectionStatus, string> = {
    [ServerConnectionStatus.CONNECTED]: '已连接',
    [ServerConnectionStatus.CONNECTING]: '连接中',
    [ServerConnectionStatus.DISCONNECTED]: '未连接',
};

// ─── Component ───────────────────────────────────────────────────────────────
export const LocalServerStatusScreen: React.FC = () => {
    const {connStatus, masterInfo, slaveConnection} = useLocalServerStatus();

    const [info, setInfo] = useState<LocalWebServerInfo | null>(null);
    const [stats, setStats] = useState<ServerStats | null>(null);
    const [loading, setLoading] = useState(true);

    const refresh = useCallback(() => {
        Promise.all([localWebServer.getLocalWebServerStatus(), localWebServer.getLocalWebServerStats()])
            .then(([i, st]) => { setInfo(i); setStats(st); })
            .finally(() => setLoading(false));
    }, []);

    useEffect(() => {
        refresh();
        const timer = setInterval(refresh, 5000);
        return () => clearInterval(timer);
    }, [refresh]);

    const serverStatus = info?.status ?? LocalWebServerStatus.STOPPED;
    const isRunning = serverStatus === LocalWebServerStatus.RUNNING;

    const statusColor = serverStatus === LocalWebServerStatus.RUNNING ? C.ok
        : serverStatus === LocalWebServerStatus.ERROR ? C.err : C.warn;
    const statusBg = serverStatus === LocalWebServerStatus.RUNNING ? C.okBg
        : serverStatus === LocalWebServerStatus.ERROR ? C.errBg : C.warnBg;

    const wsColor = connStatus === ServerConnectionStatus.CONNECTED ? C.ok
        : connStatus === ServerConnectionStatus.CONNECTING ? C.warn : C.textMuted;
    const wsBg = connStatus === ServerConnectionStatus.CONNECTED ? C.okBg
        : connStatus === ServerConnectionStatus.CONNECTING ? C.warnBg : C.divider;

    if (loading) {
        return (
            <View style={s.center}>
                <ActivityIndicator size="large" color={C.accent}/>
                <Text style={s.loadingText}>正在读取服务器状态…</Text>
            </View>
        );
    }

    return (
        <ScrollView style={s.root} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>

            {/* Header */}
            <View style={s.header}>
                <View style={s.headerRow}>
                    <Text style={s.headerTitle}>本地服务器</Text>
                    <TouchableOpacity style={s.refreshBtn} onPress={refresh} activeOpacity={0.7}>
                        <Text style={s.refreshText}>刷新</Text>
                    </TouchableOpacity>
                </View>
                <View style={s.statusRow}>
                    <Badge text={serverStatusLabel[serverStatus]} color={statusColor} bg={statusBg}/>
                    {connStatus && (
                        <Badge text={connStatusLabel[connStatus]} color={wsColor} bg={wsBg}/>
                    )}
                </View>
            </View>

            {/* 服务器配置 */}
            {info && isRunning && (
                <Section title="配置">
                    <Row label="端口" value={info.config.port} mono/>
                    <View style={s.divider}/>
                    <Row label="路径" value={info.config.basePath} mono/>
                    <View style={s.divider}/>
                    <Row label="心跳间隔" value={`${info.config.heartbeatInterval / 1000}s`}/>
                    <View style={s.divider}/>
                    <Row label="心跳超时" value={`${info.config.heartbeatTimeout / 1000}s`}/>
                </Section>
            )}

            {/* 监听地址 */}
            {info && info.addresses.length > 0 && (
                <Section title={`监听地址（${info.addresses.length}）`}>
                    {info.addresses.map((addr, i) => (
                        <React.Fragment key={addr.address}>
                            {i > 0 && <View style={s.divider}/>}
                            <View style={s.row}>
                                <Text style={s.rowLabel}>{addr.name}</Text>
                                <Text style={[s.rowValue, s.mono]} numberOfLines={1} ellipsizeMode="tail">
                                    {addr.address}
                                </Text>
                            </View>
                        </React.Fragment>
                    ))}
                </Section>
            )}

            {/* 连接统计 */}
            {stats && (
                <Section title="连接统计">
                    <Row label="主屏连接" value={stats.masterCount}/>
                    <View style={s.divider}/>
                    <Row label="副屏连接" value={stats.slaveCount}/>
                    <View style={s.divider}/>
                    <Row label="待注册" value={stats.pendingCount}/>
                    <View style={s.divider}/>
                    <Row label="运行时长" value={formatUptime(stats.uptime)}/>
                </Section>
            )}

            {/* Master 信息 */}
            {masterInfo && (
                <Section title="Master 信息">
                    <Row label="设备 ID" value={masterInfo.deviceId} mono/>
                    <View style={s.divider}/>
                    <Row label="注册时间" value={new Date(masterInfo.addedAt).toLocaleString('zh-CN')}/>
                </Section>
            )}

            {/* Slave 信息 */}
            {slaveConnection && (
                <Section title="Slave 信息">
                    <Row label="设备 ID" value={slaveConnection.deviceId} mono/>
                    <View style={s.divider}/>
                    <Row label="连接时间" value={new Date(slaveConnection.connectedAt).toLocaleString('zh-CN')}/>
                    {slaveConnection.disconnectedAt && (
                        <>
                            <View style={s.divider}/>
                            <Row label="断开时间" value={new Date(slaveConnection.disconnectedAt).toLocaleString('zh-CN')}/>
                        </>
                    )}
                </Section>
            )}

            {/* 错误信息 */}
            {info?.error && (
                <Section title="错误">
                    <View style={s.errorBox}>
                        <Text style={s.errorText}>{info.error}</Text>
                    </View>
                </Section>
            )}

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
    headerRow: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8},
    headerTitle: {fontSize: 22, fontWeight: '700', color: C.text, letterSpacing: -0.3},
    statusRow: {flexDirection: 'row', gap: 8},
    refreshBtn: {paddingHorizontal: 12, paddingVertical: 6, backgroundColor: C.accentBg, borderRadius: 8},
    refreshText: {fontSize: 13, color: C.accent, fontWeight: '600'},

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

    errorBox: {padding: 16},
    errorText: {fontSize: 13, color: C.err, fontFamily: 'monospace'},
});

// ─── Registration ─────────────────────────────────────────────────────────────
export const localServerStatusScreenPart: ScreenPartRegistration = {
    name: 'localServerStatusScreen',
    title: '本地服务器状态',
    description: '本地双机通讯服务器状态',
    partKey: 'system.admin.local.server.status',
    containerKey: uiAdminVariables.systemAdminPanel.key,
    screenMode: [ScreenMode.DESKTOP, ScreenMode.MOBILE],
    instanceMode: [InstanceMode.MASTER, InstanceMode.SLAVE],
    workspace: [Workspace.MAIN,Workspace.BRANCH],
    componentType: LocalServerStatusScreen,
    indexInContainer: 0,
};
