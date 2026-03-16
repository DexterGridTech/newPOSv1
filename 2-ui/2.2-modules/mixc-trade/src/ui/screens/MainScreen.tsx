import React, {useCallback} from 'react';
import {ScrollView, StyleSheet, Text, View} from 'react-native';
import {StackContainer, useLifecycle} from "@impos2/ui-core-base";
import {ScreenMode, ScreenPartRegistration} from "@impos2/kernel-core-base";
import {InstanceMode, Workspace} from "@impos2/kernel-core-interconnection";
import {uiMixcWorkbenchVariables} from "@impos2/ui-mixc-workbench";
import {uiMixcTradeVariables} from "../variables";
import {CreateOrderButton} from "../components";
import {PayingOrderList} from "../components/payingOrder/PayingOrderList";

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
            <View id='trade-menu-container' style={s.menuContainer}>
                <CreateOrderButton />
                <ScrollView
                    style={s.menuScroll}
                    contentContainerStyle={s.menuScrollContent}
                    showsVerticalScrollIndicator={true}
                    persistentScrollbar={true}
                >
                    <PayingOrderList />
                    <Text>销售菜单1</Text>
                    <Text>销售菜单2</Text>
                    <Text>销售菜单3</Text>
                    <Text>销售菜单4</Text>
                    <Text>销售菜单5</Text>
                    <Text>销售菜单6</Text>
                    <Text>销售菜单11</Text>
                    <Text>销售菜单12</Text>
                    <Text>销售菜单13</Text>
                    <Text>销售菜单14</Text>
                    <Text>销售菜单15</Text>
                    <Text>销售菜单16</Text>
                    <Text>销售菜单21</Text>
                    <Text>销售菜单22</Text>
                    <Text>销售菜单23</Text>
                </ScrollView>
            </View>
            <StackContainer containerPart={uiMixcTradeVariables.mixcTradePanelContainer}>
            </StackContainer>
        </View>
    );
};

// ─── Styles ──────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
    root: {
        flex: 1,
        flexDirection: 'row',
        backgroundColor: C.bg,
    },
    menuContainer: {
        width: 230,
        backgroundColor: C.surface,
        borderRightWidth: 1,
        borderRightColor: C.border,
    },
    menuScroll: {
        flex: 1,
    },
    menuScrollContent: {
        flexGrow: 1,
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
