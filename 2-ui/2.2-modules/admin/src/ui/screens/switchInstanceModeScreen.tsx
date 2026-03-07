import React from "react";
import {ScrollView, StyleSheet, Text, TouchableOpacity, View} from "react-native";
import QRCode from "react-native-qrcode-svg";
import {ScreenMode, ScreenPartRegistration} from "@impos2/kernel-core-base";
import {InstanceMode, Workspace} from "@impos2/kernel-core-interconnection";
import {uiAdminVariables} from "../variables";
import {useSwitchInstanceMode} from "../../hooks/useSwitchInstanceMode";

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
const Section: React.FC<{ title: string; children: React.ReactNode }> = ({title, children}) => (
    <View style={s.section}>
        <Text style={s.sectionTitle}>{title}</Text>
        <View style={s.card}>{children}</View>
    </View>
);

const Divider = () => <View style={s.divider}/>;

const Badge: React.FC<{ label: string; color: string; bg: string }> = ({label, color, bg}) => (
    <View style={[s.badge, {backgroundColor: bg}]}>
        <Text style={[s.badgeText, {color}]}>{label}</Text>
    </View>
);

const Btn: React.FC<{
    label: string;
    onPress: () => void;
    danger?: boolean;
    disabled?: boolean;
}> = ({label, onPress, danger, disabled}) => (
    <TouchableOpacity
        style={[s.btn, danger ? s.btnDanger : s.btnNormal, disabled && s.btnDisabled]}
        onPress={onPress}
        activeOpacity={0.7}
        disabled={disabled}
    >
        <Text style={[s.btnText, danger ? s.btnTextDanger : s.btnTextNormal, disabled && s.btnTextDisabled]}>
            {label}
        </Text>
    </TouchableOpacity>
);

// ─── Component ───────────────────────────────────────────────────────────────
export const SwitchInstanceModeScreen: React.FC = () => {
    const {
        standalone,
        enableSlave,
        masterInfo,
        isMaster,
        isSlave,
        isServerConnected,
        isServerConnecting,
        handleSetMaster,
        handleSetSlave,
        handleEnableSlave,
        handleStartConnection,
        handleAddMaster,
    } = useSwitchInstanceMode();

    const qrValue = masterInfo ? JSON.stringify(masterInfo) : null;
    const serverBtnLabel = isServerConnecting ? '连接中...' : isServerConnected ? '已启动' : '启动服务器';

    return (
        <ScrollView style={s.root} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
            <Text style={s.headerTitle}>主机模式</Text>

            {/* 当前模式 */}
            <Section title="当前模式">
                <View style={s.row}>
                    <View style={s.rowLeft}>
                        <Text style={s.rowLabel}>实例模式</Text>
                        <Badge
                            label={isMaster ? 'MASTER' : 'SLAVE'}
                            color={isMaster ? C.ok : C.warn}
                            bg={isMaster ? C.okBg : C.warnBg}
                        />
                    </View>
                    {standalone && (
                        <View style={s.rowRight}>
                            <Btn
                                label="切换为 MASTER"
                                onPress={handleSetMaster}
                                disabled={isMaster}
                            />
                            <View style={{height: 8}}/>
                            <Btn
                                label="切换为 SLAVE"
                                onPress={handleSetSlave}
                                disabled={isSlave}
                            />
                        </View>
                    )}
                    {!standalone && (
                        <Badge label="固定模式" color={C.textMuted} bg={C.divider}/>
                    )}
                </View>
            </Section>

            {/* MASTER 模式：Slave 功能 */}
            {isMaster && (
                <Section title="Slave 接入">
                    <View style={s.row}>
                        <View style={s.rowLeft}>
                            <Text style={s.rowLabel}>允许 Slave 接入</Text>
                            <Badge
                                label={enableSlave ? '已开启' : '已关闭'}
                                color={enableSlave ? C.ok : C.textMuted}
                                bg={enableSlave ? C.okBg : C.divider}
                            />
                        </View>
                        {!enableSlave && (
                            <Btn label="开启" onPress={handleEnableSlave}/>
                        )}
                    </View>

                    {enableSlave && (
                        <>
                            <Divider/>
                            <View style={s.row}>
                                <View style={s.rowLeft}>
                                    <Text style={s.rowLabel}>服务器</Text>
                                    <Text style={s.rowDesc}>启动后 Slave 设备可连接</Text>
                                </View>
                                <Btn
                                    label={serverBtnLabel}
                                    onPress={handleStartConnection}
                                    disabled={isServerConnected || isServerConnecting}
                                />
                            </View>
                        </>
                    )}
                </Section>
            )}

            {/* MasterInfo 信息展示 */}
            {masterInfo && (
                <Section title="Master 信息">
                    <View style={s.infoBlock}>
                        <View style={s.infoRow}>
                            <Text style={s.infoLabel}>设备 ID</Text>
                            <Text style={s.infoValue}>{masterInfo.deviceId}</Text>
                        </View>
                        {masterInfo.serverAddress?.map((addr, i) => (
                            <View key={i} style={s.infoRow}>
                                <Text style={s.infoLabel}>{addr.name}</Text>
                                <Text style={s.infoValue}>{addr.address}</Text>
                            </View>
                        ))}
                    </View>

                    {enableSlave && qrValue && (
                        <>
                            <Divider/>
                            <View style={s.qrBlock}>
                                <Text style={s.qrHint}>扫码连接此 Master 设备</Text>
                                <View style={s.qrWrapper}>
                                    <QRCode value={qrValue} size={180}/>
                                </View>
                            </View>
                        </>
                    )}
                </Section>
            )}

            {/* SLAVE 模式 */}
            {isSlave && (
                <Section title="Master 设备">
                    <View style={s.row}>
                        <View style={s.rowLeft}>
                            <Text style={s.rowLabel}>添加 Master 设备</Text>
                            <Text style={s.rowDesc}>扫描 Master 设备的二维码进行连接</Text>
                        </View>
                        <Btn label="添加" onPress={handleAddMaster}/>
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
    headerTitle: {fontSize: 22, fontWeight: '700', color: C.text, letterSpacing: -0.3, marginBottom: 20},

    section: {marginBottom: 16},
    sectionTitle: {fontSize: 11, fontWeight: '600', color: C.textMuted, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 8, marginLeft: 2},
    card: {backgroundColor: C.surface, borderRadius: 12, borderWidth: 1, borderColor: C.border, overflow: 'hidden'},

    row: {flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12},
    rowLeft: {flex: 1},
    rowRight: {alignItems: 'flex-end'},
    rowLabel: {fontSize: 14, color: C.text, fontWeight: '500', marginBottom: 4},
    rowDesc: {fontSize: 12, color: C.textMuted, marginTop: 2},
    divider: {height: 1, backgroundColor: C.divider, marginHorizontal: 16},

    badge: {paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, alignSelf: 'flex-start'},
    badgeText: {fontSize: 11, fontWeight: '600'},

    btn: {paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8},
    btnNormal: {backgroundColor: C.accentBg},
    btnDanger: {backgroundColor: C.errBg},
    btnDisabled: {backgroundColor: C.divider},
    btnText: {fontSize: 13, fontWeight: '600'},
    btnTextNormal: {color: C.accent},
    btnTextDanger: {color: C.err},
    btnTextDisabled: {color: C.textMuted},

    infoBlock: {paddingHorizontal: 16, paddingVertical: 12},
    infoRow: {flexDirection: 'row', marginBottom: 6},
    infoLabel: {fontSize: 12, color: C.textMuted, width: 72},
    infoValue: {fontSize: 12, color: C.text, flex: 1},

    qrBlock: {alignItems: 'center', paddingVertical: 20},
    qrHint: {fontSize: 12, color: C.textSub, marginBottom: 16},
    qrWrapper: {padding: 12, backgroundColor: C.surface, borderRadius: 12, borderWidth: 1, borderColor: C.border},
});

// ─── Registration ─────────────────────────────────────────────────────────────
export const switchInstanceModeScreenPart: ScreenPartRegistration = {
    name: 'switchInstanceModeScreenPart',
    title: '切换主机模式',
    description: '切换主机模式',
    partKey: 'system.admin.switch.instance.mode',
    containerKey: uiAdminVariables.systemAdminPanel.key,
    screenMode: [ScreenMode.DESKTOP, ScreenMode.MOBILE],
    instanceMode: [InstanceMode.MASTER, InstanceMode.SLAVE],
    workspace: [Workspace.MAIN,Workspace.BRANCH],
    componentType: SwitchInstanceModeScreen,
    indexInContainer: 0,
};
