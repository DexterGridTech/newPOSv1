import React, {useCallback} from "react";
import {useLifecycle} from "@impos2/ui-core-base";
import {Text, View} from "react-native";

export const OrderPriceConfirmContainer: React.FC = () => {
    useLifecycle({
        componentName: 'PriceKeyboard',
        onInitiated: useCallback(() => {
        }, []),
        onClearance: useCallback(() => {
        }, []),
    });
    return (
        <View>
            <Text>
                OrderPriceConfirmContainer
            </Text>
        </View>
    );
};