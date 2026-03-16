import React, {useCallback, useState, useEffect} from 'react';
import {ScrollView, StyleSheet, Text, View, ActivityIndicator} from 'react-native';
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

const MountTracker: React.FC<{onMount: () => void; children: React.ReactNode}> = ({onMount, children}) => {
    useEffect(() => {
        onMount();
    }, [onMount]);
    return <>{children}</>;
};

export const MainScreen: React.FC = () => {
    const [mountedComponents, setMountedComponents] = useState(0);
    const [mountedCount, setMountedCount] = useState(0);

    useEffect(() => {
        const timers = [
            setTimeout(() => setMountedComponents(1), 100),
            setTimeout(() => setMountedComponents(2), 200),
        ];
        return () => timers.forEach(clearTimeout);
    }, []);

    const handleMount = useCallback(() => {
        setMountedCount(prev => prev + 1);
    }, []);

    useLifecycle({
        componentName: 'MainScreen',
        onInitiated: useCallback(() => {
        }, []),
        onClearance: useCallback(() => {
        }, []),
    });

    return (
        <View style={s.root}>
            {mountedCount < 2 && (
                <View style={s.loading}>
                    <ActivityIndicator size="large" color="#4A90E2" />
                </View>
            )}
            {mountedComponents >= 1 && (
                <View id='trade-menu-container' style={s.menuContainer}>
                    <MountTracker onMount={handleMount}>
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
                    </MountTracker>
                </View>
            )}
            {mountedComponents >= 2 && (
                <View style={{flex: 1}}>
                    <MountTracker onMount={handleMount}>
                        <StackContainer containerPart={uiMixcTradeVariables.mixcTradePanelContainer}>
                        </StackContainer>
                    </MountTracker>
                </View>
            )}
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
    loading: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        zIndex: 999,
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
