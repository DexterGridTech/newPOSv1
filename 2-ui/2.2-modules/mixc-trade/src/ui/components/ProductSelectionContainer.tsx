import React, {useCallback} from "react";
import {useLifecycle} from "@impos2/ui-core-base";
import {Text, View} from "react-native";

export const ProductSelectionContainer: React.FC = () => {
    useLifecycle({
        componentName: 'ProductSelectionContainer',
        onInitiated: useCallback(() => {
        }, []),
        onClearance: useCallback(() => {
        }, []),
    });
    return (
        <View>
            <Text>
                ProductSelectionContainer
            </Text>
        </View>
    );
};