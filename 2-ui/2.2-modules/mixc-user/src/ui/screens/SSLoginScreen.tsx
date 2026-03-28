import React, {useCallback} from 'react';
import {StyleSheet, Text, View} from 'react-native';
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

export const SSLoginScreen: React.FC = () => {

    useLifecycle({
        componentName: 'SSLoginScreen',
        onInitiated: useCallback(() => {
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
                        <Text style={s.iconText}>👤</Text>
                    </View>
                </View>

                {/* 标题 */}
                <Text style={s.title}>等待用户登录</Text>

                {/* 描述 */}
                <Text style={s.description}>
                    请在主屏幕完成用户登录
                </Text>


                {/* 提示信息 */}
                <View style={s.hintBox}>
                    <Text style={s.hintText}>• 登录完成后，此页面将自动跳转</Text>
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

export const ssLoginScreenPart: ScreenPartRegistration = {
    name: 'ssLoginScreen',
    title: '用户登录(副屏)',
    description: '用户登录页面（副屏）',
    partKey: 'login-slave-secondary',
    containerKey: uiBaseCoreUiVariables.secondaryRootContainer.key,
    screenMode: [ScreenMode.DESKTOP],
    workspace: [Workspace.MAIN],
    instanceMode: [InstanceMode.SLAVE],
    componentType: SSLoginScreen,
    indexInContainer: 2,
}
