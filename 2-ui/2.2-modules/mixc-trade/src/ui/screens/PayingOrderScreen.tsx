import React, {useCallback, useState, useEffect, useMemo} from "react";
import {useLifecycle} from "@impos2/ui-core-base";
import {StyleSheet, View, useWindowDimensions, ActivityIndicator} from "react-native";
import {ScreenMode, ScreenPartRegistration} from "@impos2/kernel-core-base";
import {InstanceMode, Workspace} from "@impos2/kernel-core-interconnection";
import {useSelector} from "react-redux";
import {selectPayingOrders} from "@impos2/kernel-pay-base";
import {selectedPayingOrder} from "../../selectors/selectOrderCreation";
import {uiMixcTradeVariables} from "../variables";
import {PaymentFunctionList} from "../components/payingOrder/PaymentFunctionList";
import {PaymentList} from "../components/payingOrder/PaymentList";
import {MemberInfo} from "../components/payingOrder/MemberInfo";
import {OrderInfo} from "../components/payingOrder/OrderInfo";
import {ActionPanel} from "../components/payingOrder/ActionPanel";

const RIGHT_PANEL_WIDTH = 360;

const MountTracker: React.FC<{onMount: () => void; children: React.ReactNode}> = ({onMount, children}) => {
    useEffect(() => {
        onMount();
    }, [onMount]);
    return <>{children}</>;
};


export const PayingOrderScreen: React.FC = () => {
    const { width, height } = useWindowDimensions();
    const isPortrait = useMemo(() => height > width, [width, height]);
    const [mountedComponents, setMountedComponents] = useState(0);
    const [mountedCount, setMountedCount] = useState(0);

    const orders = useSelector(selectPayingOrders);
    const selectedOrderCode = useSelector(selectedPayingOrder);
    const currentOrder = useMemo(() =>
        orders.find(order => order.mainOrderCode === selectedOrderCode),
        [orders, selectedOrderCode]
    );

    useEffect(() => {
        const count = isPortrait ? 5 : 2;
        const timers = Array.from({length: count}, (_, i) =>
            setTimeout(() => setMountedComponents(i + 1), (i + 1) * 100)
        );
        return () => timers.forEach(clearTimeout);
    }, [isPortrait]);

    const handleMount = useCallback(() => {
        setMountedCount(prev => prev + 1);
    }, []);

    useLifecycle({
        componentName: 'PayingOrderScreen',
        onInitiated: useCallback(() => {
        }, []),
        onClearance: useCallback(() => {
        }, []),
    });


    return (
        <View style={[s.root, isPortrait && s.rootPortrait]}>
            {mountedCount < (isPortrait ? 5 : 2) && (
                <View style={s.loading}>
                    <ActivityIndicator size="large" color="#4A90E2" />
                </View>
            )}
            {isPortrait ? (
                <>
                    {mountedComponents >= 1 && (
                        <View style={s.portraitItem}>
                            <MountTracker onMount={handleMount}>
                                <MemberInfo />
                            </MountTracker>
                        </View>
                    )}
                    {mountedComponents >= 2 && (
                        <View style={s.portraitItem}>
                            <MountTracker onMount={handleMount}>
                                <OrderInfo order={currentOrder} />
                            </MountTracker>
                        </View>
                    )}
                    {mountedComponents >= 3 && (
                        <View style={s.portraitItem}>
                            <MountTracker onMount={handleMount}>
                                <PaymentFunctionList currentOrder={currentOrder} />
                            </MountTracker>
                        </View>
                    )}
                    {mountedComponents >= 4 && (
                        <View style={s.portraitItem}>
                            <MountTracker onMount={handleMount}>
                                <PaymentList />
                            </MountTracker>
                        </View>
                    )}
                    {mountedComponents >= 5 && (
                        <View style={s.portraitItem}>
                            <MountTracker onMount={handleMount}>
                                <ActionPanel />
                            </MountTracker>
                        </View>
                    )}
                </>
            ) : (
                <>
                    {mountedComponents >= 1 && (
                        <View style={s.leftColumn}>
                            <MountTracker onMount={handleMount}>
                                <View style={s.leftTop}>
                                    <PaymentFunctionList currentOrder={currentOrder} />
                                </View>
                                <View style={s.leftBottom}>
                                    <PaymentList />
                                </View>
                            </MountTracker>
                        </View>
                    )}
                    {mountedComponents >= 2 && (
                        <View style={s.rightColumn}>
                            <MountTracker onMount={handleMount}>
                                <View style={s.rightTop}>
                                    <MemberInfo />
                                </View>
                                <View style={s.rightMiddle}>
                                    <OrderInfo order={currentOrder} />
                                </View>
                                <View style={s.rightBottom}>
                                    <ActionPanel />
                                </View>
                            </MountTracker>
                        </View>
                    )}
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
    rootPortrait: {
        flexDirection: 'column',
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
    // 横屏布局
    leftColumn: {
        flex: 1,
        flexDirection: 'column',
    },
    leftTop: {
        height: 200,
    },
    leftBottom: {
        flex: 1,
    },
    rightColumn: {
        width: RIGHT_PANEL_WIDTH,
        flexDirection: 'column',
    },
    rightTop: {
        height: 150,
    },
    rightMiddle: {
        flex: 1,
    },
    rightBottom: {
        height: 120,
    },
    // 竖屏布局
    portraitItem: {
        minHeight: 100,
    },
});

export const payingOrderScreenPart: ScreenPartRegistration = {
    name: 'payingOrderScreen',
    title: '订单支付',
    description: '订单支付',
    partKey: 'order-payment',
    containerKey: uiMixcTradeVariables.mixcTradePanelContainer.key,
    screenMode: [ScreenMode.DESKTOP],
    workspace: [Workspace.MAIN, Workspace.BRANCH],
    instanceMode: [InstanceMode.MASTER, InstanceMode.SLAVE],
    componentType: PayingOrderScreen,
    indexInContainer: 3,
}
