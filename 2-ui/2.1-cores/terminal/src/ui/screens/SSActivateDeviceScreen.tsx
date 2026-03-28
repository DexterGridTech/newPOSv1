import React, {useCallback, useState, useEffect} from 'react';
import {View, Text, StyleSheet} from 'react-native';
import {device, getDeviceId} from '@impos2/kernel-core-base';
import {uiBaseCoreUiVariables, useLifecycle} from "@impos2/ui-core-base";
import {ScreenMode, ScreenPartRegistration} from "@impos2/kernel-core-base";
import {InstanceMode, Workspace} from "@impos2/kernel-core-interconnection";

// ─── Design Tokens ───────────────────────────────────────────────────────────
const C = {
    bg: '#F8FAFC',
    surface: '#FFFFFF',
    border: '#E2E8F0',
    text: '#0F172A',
    textSub: '#64748B',
    textMuted: '#94A3B8',
    accent: '#0369A1',
    accentBg: '#EFF6FF',
} as const;

export const SSActivateDeviceScreen: React.FC = () => {
    const [deviceId, setDeviceId] = useState<string>('');

    useLifecycle({
        componentName: 'SSActivateDeviceScreen',
        onInitiated: useCallback(() => {
            setDeviceId(getDeviceId())
        }, []),
        onClearance: useCallback(() => {
        }, []),
    });

    return (
        <View style={s.root}>
            <View style={s.container}>
                {/* 图标区域 */}
                <View style={s.iconBox}>
                    <View style={s.iconCircle}>
                        <Text style={s.iconText}>⏳</Text>
                    </View>
                </View>

                {/* 标题 */}
                <Text style={s.title}>等待设备激活</Text>

                {/* 描述 */}
                <Text style={s.description}>
                    请在主屏幕完成设备激活流程
                </Text>

                {/* 设备信息卡片 */}
                {deviceId && (
                    <View style={s.card}>
                        <View style={s.cardRow}>
                            <Text style={s.cardLabel}>设备 ID</Text>
                            <Text style={s.cardValue}>{deviceId}</Text>
                        </View>
                    </View>
                )}

                {/* 提示信息 */}
                <View style={s.hintBox}>
                    <Text style={s.hintText}>• 激活完成后，此页面将自动跳转</Text>
                    <Text style={s.hintText}>• 请勿关闭或刷新此页面</Text>
                </View>
            </View>
        </View>
    );
};

// ─── Styles ──────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
    root: {
        flex: 1,
        backgroundColor: C.bg,
        justifyContent: 'center',
        alignItems: 'center',
    },
    container: {
        alignItems: 'center',
        paddingHorizontal: 40,
        maxWidth: 480,
    },
    iconBox: {
        marginBottom: 32,
    },
    iconCircle: {
        width: 120,
        height: 120,
        borderRadius: 60,
        backgroundColor: C.accentBg,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: C.accent,
    },
    iconText: {
        fontSize: 56,
    },
    title: {
        fontSize: 32,
        fontWeight: '700',
        color: C.text,
        letterSpacing: -0.5,
        marginBottom: 16,
        textAlign: 'center',
    },
    description: {
        fontSize: 18,
        color: C.textSub,
        textAlign: 'center',
        marginBottom: 32,
        lineHeight: 26,
    },
    card: {
        backgroundColor: C.surface,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: C.border,
        paddingHorizontal: 24,
        paddingVertical: 20,
        width: '100%',
        marginBottom: 32,
    },
    cardRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    cardLabel: {
        fontSize: 14,
        color: C.textMuted,
        fontWeight: '500',
    },
    cardValue: {
        fontSize: 14,
        color: C.text,
        fontWeight: '600',
        fontFamily: 'monospace',
    },
    hintBox: {
        alignItems: 'flex-start',
        width: '100%',
    },
    hintText: {
        fontSize: 14,
        color: C.textMuted,
        marginBottom: 8,
        lineHeight: 20,
    },
});

export const ssActivateDeviceScreenPart: ScreenPartRegistration = {
    name: 'ssActivateDeviceScreen',
    title: '设备激活(副屏)',
    description: '设备激活页面（副屏）',
    partKey: 'activate-slave-secondary',
    containerKey: uiBaseCoreUiVariables.secondaryRootContainer.key,
    screenMode: [ScreenMode.DESKTOP],
    workspace:[Workspace.MAIN],
    instanceMode:[InstanceMode.SLAVE],
    componentType: SSActivateDeviceScreen,
    indexInContainer: 1,
}
