import React from "react";
import {ScrollView, StyleSheet, Text, View} from "react-native";
import {ScreenMode, ScreenPartRegistration} from "@impos2/kernel-core-base";
import {InstanceMode, ServerConnectionStatus, Workspace} from "@impos2/kernel-core-interconnection";
import {uiAdminVariables} from "../variables";
import {useTerminalConnection} from "../../hooks/useTerminalConnection";

// ─── Design Tokens ───────────────────────────────────────────────────────────
const C = {
    bg: '#F0F2F5',
    surface: '#FFFFFF',
    border: '#E2E8F0',
    text: '#0F172A',
    textSub: '#64748B',
    textMuted: '#94A3B8',
    ok: '#16A34A',
    okBg: '#F0FDF4',
    warn: '#D97706',
    warnBg: '#FFFBEB',
    err: '#DC2626',
    divider: '#F1F5F9',
} as const;

// ─── Helpers ─────────────────────────────────────────────────────────────────
const connStatusLabel: Record<ServerConnectionStatus, string> = {
    [ServerConnectionStatus.CONNECTED]: '已连接',
    [ServerConnectionStatus.CONNECTING]: '连接中',
    [ServerConnectionStatus.DISCONNECTED]: '未连接',
};

const connStatusColor: Record<ServerConnectionStatus, string> = {
    [ServerConnectionStatus.CONNECTED]: C.ok,
    [ServerConnectionStatus.CONNECTING]: C.warn,
    [ServerConnectionStatus.DISCONNECTED]: C.textMuted,
};

const connStatusBg: Record<ServerConnectionStatus, string> = {
    [ServerConnectionStatus.CONNECTED]: C.okBg,
    [ServerConnectionStatus.CONNECTING]: C.warnBg,
    [ServerConnectionStatus.DISCONNECTED]: C.divider,
};

const formatTime = (ts?: number | null): string =>
    ts ? new Date(ts).toLocaleString('zh-CN') : '—';

const formatDuration = (connectedAt: number, disconnectedAt: number): string => {
    const ms = disconnectedAt - connectedAt;
    if (ms <= 0) return '—';
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const h = Math.floor(m / 60);
    if (h > 0) return `${h}h ${m % 60}m`;
    if (m > 0) return `${m}m ${s % 60}s`;
    return `${s}s`;
};

const Row: React.FC<{ label: string; value?: string | null; mono?: boolean }> = ({label, value, mono}) => (
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

// ─── Component ───────────────────────────────────────────────────────────────
export const TerminalConnectionScreen: React.FC = () => {
    const {serverConnectionStatus, connectedAt, disconnectedAt, connectionError, connectionHistory} = useTerminalConnection();

    const status = serverConnectionStatus ?? ServerConnectionStatus.DISCONNECTED;
    const isConnected = status === ServerConnectionStatus.CONNECTED;
    const isDisconnected = status === ServerConnectionStatus.DISCONNECTED;

    return (
        <ScrollView style={s.root} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>

            <View style={s.header}>
                <View style={s.headerRow}>
                    <Text style={s.headerTitle}>终端连接</Text>
                    <Badge
                        text={connStatusLabel[status]}
                        color={connStatusColor[status]}
                        bg={connStatusBg[status]}
                    />
                </View>
            </View>

            <Section title="当前状态">
                <Row label="连接状态" value={connStatusLabel[status]}/>
                <View style={s.divider}/>
                <Row label="连接时间" value={!isDisconnected ? formatTime(connectedAt) : '—'}/>
                {isDisconnected && (
                    <>
                        <View style={s.divider}/>
                        <Row label="断开时间" value={formatTime(disconnectedAt)}/>
                    </>
                )}
            </Section>

            {!!connectionError && (
                <Section title="错误">
                    <View style={s.errorBox}>
                        <Text style={s.errorText}>{connectionError}</Text>
                    </View>
                </Section>
            )}

            {connectionHistory.length > 0 && (
                <Section title={`连接历史（${connectionHistory.length}）`}>
                    {connectionHistory.length > 10 && (
                        <View style={s.historyHint}>
                            <Text style={s.historyHintText}>共 {connectionHistory.length} 条，仅显示最近 10 条</Text>
                        </View>
                    )}
                    {connectionHistory.slice(-10).reverse().map((item, i) => (
                        <React.Fragment key={i}>
                            {i > 0 && <View style={s.divider}/>}
                            <View style={s.historyItem}>
                                <View style={s.historyRow}>
                                    <Text style={s.rowLabel}>连接</Text>
                                    <Text style={s.rowValue}>{formatTime(item.connectedAt)}</Text>
                                </View>
                                <View style={s.historyRow}>
                                    <Text style={s.rowLabel}>断开</Text>
                                    <Text style={s.rowValue}>{formatTime(item.disconnectedAt)}</Text>
                                </View>
                                <View style={s.historyRow}>
                                    <Text style={s.rowLabel}>持续</Text>
                                    <Text style={s.rowValue}>{formatDuration(item.connectedAt, item.disconnectedAt)}</Text>
                                </View>
                                {!!item.connectionError && (
                                    <View style={s.historyRow}>
                                        <Text style={s.rowLabel}>原因</Text>
                                        <Text style={[s.rowValue, {color: C.err}]} numberOfLines={2}>{item.connectionError}</Text>
                                    </View>
                                )}
                            </View>
                        </React.Fragment>
                    ))}
                </Section>
            )}

        </ScrollView>
    );
};

// ─── Styles ──────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
    root: {flex: 1, backgroundColor: C.bg},
    content: {padding: 20, paddingBottom: 40},

    header: {marginBottom: 20},
    headerRow: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'},
    headerTitle: {fontSize: 22, fontWeight: '700', color: C.text, letterSpacing: -0.3},

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

    historyHint: {paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.divider},
    historyHintText: {fontSize: 12, color: C.textMuted, textAlign: 'center'},

    historyItem: {paddingHorizontal: 16, paddingVertical: 10, gap: 4},
    historyRow: {flexDirection: 'row', alignItems: 'center', paddingVertical: 2},
});

// ─── Registration ─────────────────────────────────────────────────────────────
export const terminalConnectionScreenPart: ScreenPartRegistration = {
    name: 'terminalConnectionScreen',
    title: '终端连接状态',
    description: '终端连接状态',
    partKey: 'system.admin.local.terminal.connection.status',
    containerKey: uiAdminVariables.systemAdminPanel.key,
    screenMode: [ScreenMode.DESKTOP, ScreenMode.MOBILE],
    instanceMode: [InstanceMode.MASTER, InstanceMode.SLAVE],
    workspace: [Workspace.MAIN,Workspace.BRANCH],
    componentType: TerminalConnectionScreen,
    indexInContainer: 0,
};
