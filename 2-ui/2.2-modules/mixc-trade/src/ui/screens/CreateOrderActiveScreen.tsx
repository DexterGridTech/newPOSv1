import React, {useCallback, useMemo} from "react";
import {useLifecycle} from "@impos2/ui-core-base";
import {StyleSheet, View, useWindowDimensions} from "react-native";
import {ScreenMode, ScreenPartRegistration} from "@impos2/kernel-core-base";
import {InstanceMode, Workspace} from "@impos2/kernel-core-interconnection";
import {uiMixcTradeVariables} from "../variables";
import {ProductSelectionContainer} from "../components/creactOrderActive/ProductSelectionContainer";
import {OrderPriceConfirmContainer} from "../components/creactOrderActive/OrderPriceConfirmContainer";
import {ProductOrderContainer} from "../components/creactOrderActive/ProductOrderContainer";
import {PriceKeyboard} from "../components/creactOrderActive/PriceKeyboard";

const RIGHT_PANEL_WIDTH = 340;

export const CreateOrderActiveScreen: React.FC = () => {
    const { width, height } = useWindowDimensions();
    const isPortrait = useMemo(() => height > width, [width, height]);

    useLifecycle({
        componentName: 'CreateOrderActiveScreen',
        onInitiated: useCallback(() => {
        }, []),
        onClearance: useCallback(() => {
        }, []),
    });

    return (
        <View style={s.root}>
            <View style={[s.item, isPortrait ? s.portraitItem1 : s.landscapeTopLeft]}>
                <ProductSelectionContainer />
            </View>
            <View style={[s.item, isPortrait ? s.portraitItem2 : s.landscapeBottomLeft]}>
                <ProductOrderContainer />
            </View>
            <View style={[s.item, isPortrait ? s.portraitItem3 : s.landscapeBottomRight]}>
                <PriceKeyboard />
            </View>
            <View style={[s.item, isPortrait ? s.portraitItem4 : s.landscapeTopRight]}>
                <OrderPriceConfirmContainer />
            </View>
        </View>
    );
};

const s = StyleSheet.create({
    root: {
        flex: 1,
        position: 'relative',
    },
    item: {
        position: 'absolute',
        overflow: 'hidden',
    },
    // 横屏布局
    landscapeTopLeft: {
        top: 0,
        left: 0,
        right: RIGHT_PANEL_WIDTH,
        height: '50%',
    },
    landscapeBottomLeft: {
        bottom: 0,
        left: 0,
        right: RIGHT_PANEL_WIDTH,
        height: '50%',
    },
    landscapeTopRight: {
        top: 0,
        right: 0,
        width: RIGHT_PANEL_WIDTH,
        height: '50%',
    },
    landscapeBottomRight: {
        bottom: 0,
        right: 0,
        width: RIGHT_PANEL_WIDTH,
        height: '50%',
    },
    // 竖屏布局
    portraitItem1: {
        top: 0,
        left: 0,
        right: 0,
        height: '25%',
    },
    portraitItem2: {
        top: '25%',
        left: 0,
        right: 0,
        height: '25%',
    },
    portraitItem3: {
        top: '50%',
        left: 0,
        right: 0,
        height: '25%',
    },
    portraitItem4: {
        bottom: 0,
        left: 0,
        right: 0,
        height: '25%',
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
