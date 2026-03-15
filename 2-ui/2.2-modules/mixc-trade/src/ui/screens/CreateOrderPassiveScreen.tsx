import React, {useCallback} from "react";
import {useLifecycle} from "@impos2/ui-core-base";
import {StyleSheet, View, Text, Pressable} from "react-native";
import {ScreenMode, ScreenPartRegistration, shortId} from "@impos2/kernel-core-base";
import {InstanceMode, Workspace} from "@impos2/kernel-core-interconnection";
import {uiMixcTradeVariables} from "../variables";
import {ProductSelectionContainer} from "../components/creactOrderActive/ProductSelectionContainer";
import {OrderPriceConfirmContainer} from "../components/creactOrderActive/OrderPriceConfirmContainer";
import {ProductOrderContainer} from "../components/creactOrderActive/ProductOrderContainer";
import {PriceKeyboard} from "../components/creactOrderActive/PriceKeyboard";
import {uiMixcTradeCommands} from "../../features/commands";


export const CreateOrderPassiveScreen: React.FC = () => {
    useLifecycle({
        componentName: 'CreateOrderPassiveScreen',
        onInitiated: useCallback(() => {
        }, []),
        onClearance: useCallback(() => {
        }, []),
    });

    const handleManualOrder = useCallback(() => {
        uiMixcTradeCommands.setOrderCreationTypeToActive().execute(shortId());
    }, []);

    return (
        <View style={s.root}>
            <View style={s.titleBar}>
                <Text style={s.titleText}>码牌开单</Text>
                <Pressable
                    style={({pressed}) => [
                        s.manualButton,
                        pressed && s.buttonPressed,
                    ]}
                    onPress={handleManualOrder}
                >
                    <Text style={s.manualButtonText}>手动开单</Text>
                </Pressable>
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
    manualButton: {
        paddingHorizontal: 20,
        paddingVertical: 10,
        backgroundColor: '#FFFFFF',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#4A90E2',
        shadowColor: '#000',
        shadowOffset: {width: 0, height: 2},
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    manualButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#4A90E2',
    },
    buttonPressed: {
        transform: [{scale: 0.98}],
        opacity: 0.9,
    },
});

export const createOrderPassiveScreenPart: ScreenPartRegistration = {
    name: 'createOrderPassiveScreen',
    title: '码牌开单',
    description: '码牌开单',
    partKey: 'create-order-passive',
    containerKey: uiMixcTradeVariables.mixcTradePanelContainer.key,
    screenMode: [ScreenMode.DESKTOP],
    workspace: [Workspace.MAIN, Workspace.BRANCH],
    instanceMode: [InstanceMode.MASTER, InstanceMode.SLAVE],
    componentType: CreateOrderPassiveScreen,
    indexInContainer: 2,
}
