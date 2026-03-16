import React, {useCallback} from "react";
import {useLifecycle} from "@impos2/ui-core-base";
import {StyleSheet, Text, View} from "react-native";


export const PaymentFunctionList: React.FC = () => {
    useLifecycle({
        componentName: 'PaymentFunctionList',
        onInitiated: useCallback(() => {
        }, []),
        onClearance: useCallback(() => {
        }, []),
    });


    return (
        <View style={s.root}>
            <View style={s.titleBar}>
                <Text style={s.titleText}>支付方式</Text>
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