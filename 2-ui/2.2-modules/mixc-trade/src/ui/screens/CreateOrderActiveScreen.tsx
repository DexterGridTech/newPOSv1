import React, {useCallback, useMemo, useState, useEffect} from "react";
import {useLifecycle} from "@impos2/ui-core-base";
import {StyleSheet, View, useWindowDimensions, ActivityIndicator} from "react-native";
import {ScreenMode, ScreenPartRegistration} from "@impos2/kernel-core-base";
import {InstanceMode, Workspace} from "@impos2/kernel-core-interconnection";
import {uiMixcTradeVariables} from "../variables";
import {ProductSelectionContainer} from "../components/creactOrderActive/ProductSelectionContainer";
import {OrderPriceConfirmContainer} from "../components/creactOrderActive/OrderPriceConfirmContainer";
import {ProductOrderContainer} from "../components/creactOrderActive/ProductOrderContainer";
import {PriceKeyboard} from "../components/creactOrderActive/PriceKeyboard";

const RIGHT_PANEL_WIDTH = 340;

const MountTracker: React.FC<{onMount: () => void; children: React.ReactNode}> = ({onMount, children}) => {
    useEffect(() => {
        onMount();
    }, [onMount]);
    return <>{children}</>;
};

export const CreateOrderActiveScreen: React.FC = () => {
    const { width, height } = useWindowDimensions();
    const isPortrait = useMemo(() => height > width, [width, height]);
    const [mountedComponents, setMountedComponents] = useState(0);
    const [mountedCount, setMountedCount] = useState(0);

    useEffect(() => {
        const timers = [
            setTimeout(() => setMountedComponents(1), 100),
            setTimeout(() => setMountedComponents(2), 200),
            setTimeout(() => setMountedComponents(3), 300),
            setTimeout(() => setMountedComponents(4), 400),
        ];
        return () => timers.forEach(clearTimeout);
    }, []);

    const handleMount = useCallback(() => {
        setMountedCount(prev => prev + 1);
    }, []);

    useLifecycle({
        componentName: 'CreateOrderActiveScreen',
        onInitiated: useCallback(() => {
        }, []),
        onClearance: useCallback(() => {
        }, []),
    });

    return (
        <View style={s.root}>
            {mountedCount < 4 && (
                <View style={s.loading}>
                    <ActivityIndicator size="large" color="#4A90E2" />
                </View>
            )}
            {isPortrait ? (
                <>
                    {mountedComponents >= 1 && (
                        <View style={s.portraitItem}>
                            <MountTracker onMount={handleMount}>
                                <ProductSelectionContainer />
                            </MountTracker>
                        </View>
                    )}
                    {mountedComponents >= 2 && (
                        <View style={s.portraitItem}>
                            <MountTracker onMount={handleMount}>
                                <ProductOrderContainer />
                            </MountTracker>
                        </View>
                    )}
                    {mountedComponents >= 3 && (
                        <View style={s.portraitItem}>
                            <MountTracker onMount={handleMount}>
                                <PriceKeyboard />
                            </MountTracker>
                        </View>
                    )}
                    {mountedComponents >= 4 && (
                        <View style={s.portraitItem}>
                            <MountTracker onMount={handleMount}>
                                <OrderPriceConfirmContainer />
                            </MountTracker>
                        </View>
                    )}
                </>
            ) : (
                <>
                    <View style={s.leftColumn}>
                        {mountedComponents >= 1 && (
                            <View style={s.leftTop}>
                                <MountTracker onMount={handleMount}>
                                    <ProductSelectionContainer />
                                </MountTracker>
                            </View>
                        )}
                        {mountedComponents >= 2 && (
                            <View style={s.leftBottom}>
                                <MountTracker onMount={handleMount}>
                                    <ProductOrderContainer />
                                </MountTracker>
                            </View>
                        )}
                    </View>
                    <View style={s.rightColumn}>
                        {mountedComponents >= 4 && (
                            <View style={s.rightTop}>
                                <MountTracker onMount={handleMount}>
                                    <OrderPriceConfirmContainer />
                                </MountTracker>
                            </View>
                        )}
                        {mountedComponents >= 3 && (
                            <View style={s.rightBottom}>
                                <MountTracker onMount={handleMount}>
                                    <PriceKeyboard />
                                </MountTracker>
                            </View>
                        )}
                    </View>
                </>
            )}
        </View>
    );
};

const s = StyleSheet.create({
    root: {
        flex: 1,
        flexDirection: 'row',
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
    leftColumn: {
        flex: 1,
        flexDirection: 'column',
    },
    leftTop: {
        flex: 1,
    },
    leftBottom: {
        flex: 1,
    },
    rightColumn: {
        width: RIGHT_PANEL_WIDTH,
        flexDirection: 'column',
    },
    rightTop: {
        flex: 1,
    },
    rightBottom: {
        flex: 1,
    },
    portraitItem: {
        flex: 1,
    },
});

export const createOrderActiveScreenPart: ScreenPartRegistration = {
    name: 'createOrderActiveScreenPart',
    title: '我要开单',
    description: '我要开单',
    partKey: 'create-order-active',
    containerKey: uiMixcTradeVariables.mixcTradePanelContainer.key,
    screenMode: [ScreenMode.DESKTOP],
    workspace: [Workspace.MAIN, Workspace.BRANCH],
    instanceMode: [InstanceMode.MASTER, InstanceMode.SLAVE],
    componentType: CreateOrderActiveScreen,
    indexInContainer: 1,
}
