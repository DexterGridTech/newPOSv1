import React, {useCallback} from "react";
import {useLifecycle} from "@impos2/ui-core-base";
import {StyleSheet, Text, View} from "react-native";
import {ScreenMode, ScreenPartRegistration} from "@impos2/kernel-core-base";
import {InstanceMode, Workspace} from "@impos2/kernel-core-interconnection";
import {uiMixcTradeVariables} from "../variables";


export const PayingOrderScreen: React.FC = () => {
    useLifecycle({
        componentName: 'PayingOrderScreen',
        onInitiated: useCallback(() => {
        }, []),
        onClearance: useCallback(() => {
        }, []),
    });


    return (
        <View style={s.root}>
            <View style={s.titleBar}>
                <Text style={s.titleText}>订单支付</Text>
            </View>
        </View>
    );
};

const s = StyleSheet.create({
    root: {
        flex: 1,
        flexDirection: 'column',
    },
    titleBar: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 8,
    },
    titleText: {
        fontSize: 20,
        fontWeight: '600',
        color: '#212529',
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
