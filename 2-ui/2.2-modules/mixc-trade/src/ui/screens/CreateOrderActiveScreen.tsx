import React, {useCallback} from "react";
import {useLifecycle} from "@impos2/ui-core-base";
import {StyleSheet, View} from "react-native";
import {ScreenMode, ScreenPartRegistration} from "@impos2/kernel-core-base";
import {InstanceMode, Workspace} from "@impos2/kernel-core-interconnection";
import {uiMixcTradeVariables} from "../variables";
import {ProductSelectionContainer} from "../components/ProductSelectionContainer";
import {OrderPriceConfirmContainer} from "../components/OrderPriceConfirmContainer";
import {ProductOrderContainer} from "../components/ProductOrderContainer";
import {PriceKeyboard} from "../components/PriceKeyboard";

const RIGHT_PANEL_WIDTH = 400;

export const CreateOrderActiveScreen: React.FC = () => {
    useLifecycle({
        componentName: 'CreateOrderActiveScreen',
        onInitiated: useCallback(() => {
        }, []),
        onClearance: useCallback(() => {
        }, []),
    });
    return (
        <View style={s.root}>
            <View style={s.leftCol}>
                <View style={s.topLeft}>
                    <ProductSelectionContainer />
                </View>
                <View style={s.bottomLeft}>
                    <ProductOrderContainer />
                </View>
            </View>
            <View style={s.rightCol}>
                <View style={s.topRight}>
                    <OrderPriceConfirmContainer />
                </View>
                <View style={s.bottomRight}>
                    <PriceKeyboard />
                </View>
            </View>
        </View>
    );
};

const s = StyleSheet.create({
    root: {
        flex: 1,
        flexDirection: 'row',
    },
    leftCol: {
        flex: 1,
        flexDirection: 'column',
    },
    rightCol: {
        width: RIGHT_PANEL_WIDTH,
        flexDirection: 'column',
    },
    topLeft: {
        flex: 1,
    },
    bottomLeft: {
        flex: 1,
    },
    topRight: {
        flex: 1,
    },
    bottomRight: {
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
