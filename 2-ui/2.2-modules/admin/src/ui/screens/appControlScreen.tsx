import React from "react";
import {ScrollView, StyleSheet, Text, TouchableOpacity, View} from "react-native";
import {ScreenMode, ScreenPartRegistration} from "@impos2/kernel-core-base";
import {InstanceMode, Workspace} from "@impos2/kernel-core-interconnection";
import {uiAdminVariables} from "../variables";
import {useAppControl} from "../../hooks/useAppControl";

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

const ToggleRow: React.FC<{
    label: string;
    active: boolean; onPress: () => void;
    activeLabel?: string; inactiveLabel?: string;
    activeBtnLabel?: string; inactiveBtnLabel?: string;
}> = ({label, active, onPress, activeLabel = '已开启', inactiveLabel = '已关闭', activeBtnLabel = '关闭', inactiveBtnLabel = '开启'}) => (
    <View style={s.row}>
        <View style={s.rowLeft}>
            <Text style={s.rowLabel}>{label}</Text>
            <View style={[s.badge, {backgroundColor: active ? C.okBg : C.divider, alignSelf: 'flex-start', marginTop: 4}]}>
                <Text style={[s.badgeText, {color: active ? C.ok : C.textMuted}]}>
                    {active ? activeLabel : inactiveLabel}
                </Text>
            </View>
        </View>
        <TouchableOpacity style={[s.btn, s.btnNormal]} onPress={onPress} activeOpacity={0.7}>
            <Text style={s.btnTextNormal}>{active ? activeBtnLabel : inactiveBtnLabel}</Text>
        </TouchableOpacity>
    </View>
);

const ActionRow: React.FC<{
    label: string; desc: string; btnLabel: string;
    onPress: () => void; danger?: boolean;
}> = ({label, desc, btnLabel, onPress, danger}) => (
    <View style={s.row}>
        <View style={s.rowLeft}>
            <Text style={s.rowLabel}>{label}</Text>
            <Text style={s.rowDesc}>{desc}</Text>
        </View>
        <TouchableOpacity
            style={[s.btn, danger ? s.btnDanger : s.btnNormal]}
            onPress={onPress} activeOpacity={0.7}
        >
            <Text style={[s.btnText, danger ? s.btnTextDanger : s.btnTextNormal]}>{btnLabel}</Text>
        </TouchableOpacity>
    </View>
);

// ─── Component ───────────────────────────────────────────────────────────────
export const AppControlScreen: React.FC = (props) => {
    const {
        isFullScreen, isLocked,
        selectedSpace, spaceNames,
        isBound,
        handleToggleFullScreen, handleToggleLock, handleRestartApp,
        handleSwitchSpace, handleClearCache, handleUnbindDevice,
    } = useAppControl();

    return (
        <ScrollView style={s.root} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>

            <Text style={s.headerTitle}>APP 控制</Text>

            {/* 屏幕控制 */}
            <Section title="屏幕控制">
                <ToggleRow label="全屏模式" active={isFullScreen} onPress={handleToggleFullScreen}/>
                <View style={s.divider}/>
                <ToggleRow label="锁定应用" active={isLocked} onPress={handleToggleLock}/>
            </Section>

            {/* 服务器空间 */}
            {spaceNames.length > 1 && (
            <Section title="服务器空间">
                {spaceNames.map((name, i) => {
                    const isCurrent = name === selectedSpace;
                    return (
                        <React.Fragment key={name}>
                            {i > 0 && <View style={s.divider}/>}
                            <View style={s.row}>
                                <View style={s.rowLeft}>
                                    <Text style={[s.rowLabel, isCurrent && {color: C.accent}]}>{name}</Text>
                                    {isCurrent && (
                                        <View style={[s.badge, {backgroundColor: C.accentBg, alignSelf: 'flex-start', marginTop: 4}]}>
                                            <Text style={[s.badgeText, {color: C.accent}]}>当前</Text>
                                        </View>
                                    )}
                                </View>
                                {!isCurrent && (
                                    <TouchableOpacity
                                        style={[s.btn, s.btnNormal]}
                                        onPress={() => handleSwitchSpace(name)} activeOpacity={0.7}
                                    >
                                        <Text style={s.btnTextNormal}>切换</Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                        </React.Fragment>
                    );
                })}
            </Section>
            )}

            {/* 数据管理 */}
            <Section title="数据管理">
                <ActionRow
                    label="清空缓存" desc="清除本地缓存数据，需重新加载"
                    btnLabel="清空" onPress={handleClearCache}
                />
                {isBound && (
                    <>
                        <View style={s.divider}/>
                        <ActionRow
                            label="设备绑定" desc="当前设备已绑定终端"
                            btnLabel="解绑设备" onPress={handleUnbindDevice} danger
                        />
                    </>
                )}
            </Section>

            {/* 应用管理 */}
            <Section title="应用管理">
                <ActionRow
                    label="重启应用" desc="重新启动当前应用"
                    btnLabel="重启" onPress={handleRestartApp}
                />
            </Section>

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
    rowLabel: {fontSize: 14, color: C.text, fontWeight: '500'},
    rowDesc: {fontSize: 12, color: C.textMuted, marginTop: 2},
    divider: {height: 1, backgroundColor: C.divider, marginHorizontal: 16},

    badge: {paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6},
    badgeText: {fontSize: 11, fontWeight: '600'},

    btn: {paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8},
    btnNormal: {backgroundColor: C.accentBg},
    btnDanger: {backgroundColor: C.errBg},
    btnText: {fontSize: 13, fontWeight: '600'},
    btnTextNormal: {color: C.accent},
    btnTextDanger: {color: C.err},
});

// ─── Registration ─────────────────────────────────────────────────────────────
export const appControlScreenPart: ScreenPartRegistration = {
    name: 'appControlScreen',
    title: 'APP控制',
    description: '控制当前APP',
    partKey: 'system.admin.app.control',
    containerKey: uiAdminVariables.systemAdminPanel.key,
    screenMode: [ScreenMode.DESKTOP, ScreenMode.MOBILE],
    instanceMode: [InstanceMode.MASTER],
    workspace: [Workspace.MAIN],
    componentType: AppControlScreen,
    indexInContainer: 0,
};
