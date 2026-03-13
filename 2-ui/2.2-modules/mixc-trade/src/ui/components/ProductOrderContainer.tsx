import React, {useCallback} from "react";
import {useLifecycle} from "@impos2/ui-core-base";
import {Text, View} from "react-native";

export const ProductOrderContainer: React.FC = () => {
    useLifecycle({
        componentName: 'ProductOrderContainer',
        onInitiated: useCallback(() => {
        }, []),
        onClearance: useCallback(() => {
        }, []),
    });
    return (
        <View>
            <Text>
                ProductOrderContainer
            </Text>
        </View>
    );
};