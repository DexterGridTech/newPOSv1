import React, {useCallback} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {useLifecycle} from "@impos2/ui-core-base";
import {ScreenMode, ScreenPartRegistration} from "@impos2/kernel-core-base";
import {InstanceMode, Workspace} from "@impos2/kernel-core-interconnection";
import {uiMixcWorkbenchVariables} from "@impos2/ui-mixc-workbench";

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

export const MainScreen: React.FC = () => {

    useLifecycle({
        componentName: 'MainScreen',
        onInitiated: useCallback(() => {
        }, []),
        onClearance: useCallback(() => {
        }, []),
    });

    return (
        <View style={s.root}>
            <Text>销售页面</Text>
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
});

export const mpMainScreenPart: ScreenPartRegistration = {
    name: 'mpMainScreenPart',
    title: '销售',
    description: '销售页面（主屏）',
    partKey: 'trade-master-primary',
    containerKey: uiMixcWorkbenchVariables.workbenchMainContainer.key,
    screenMode: [ScreenMode.DESKTOP],
    workspace: [Workspace.MAIN],
    instanceMode: [InstanceMode.MASTER],
    componentType: MainScreen,
    indexInContainer: 2,
}
export const spMainScreenPart: ScreenPartRegistration = {
    name: 'spMainScreenPart',
    title: '销售',
    description: '销售页面（副屏）',
    partKey: 'trade-slave-primary',
    containerKey: uiMixcWorkbenchVariables.workbenchMainContainer.key,
    screenMode: [ScreenMode.DESKTOP],
    workspace: [Workspace.BRANCH],
    instanceMode: [InstanceMode.SLAVE],
    componentType: MainScreen,
    indexInContainer: 2,
}
