import React, {useCallback, useMemo} from "react";
import {useLifecycle} from "@impos2/ui-core-base";
import {StyleSheet, Text, View, FlatList, Platform} from "react-native";
import {useSelector} from "react-redux";
import {selectPaymentFunction, PaymentFunction} from "@impos2/kernel-mixc-order-pay";
import {PaymentFunctionItem} from "./PaymentFunctionItem";

export const PaymentFunctionList: React.FC = () => {
    const paymentFunctions = useSelector(selectPaymentFunction);

    const sortedPaymentFunctions = useMemo(() =>
        [...paymentFunctions].sort((a, b) => a.displayIndex - b.displayIndex),
        [paymentFunctions]
    );

    const handlePress = useCallback((paymentFunction: PaymentFunction) => {
        console.log('PaymentFunction clicked:', paymentFunction);
    }, []);

    const renderItem = useCallback(({item}: {item: PaymentFunction}) => (
        <PaymentFunctionItem paymentFunction={item} onPress={handlePress}/>
    ), [handlePress]);

    useLifecycle({
        componentName: 'PaymentFunctionList',
        onInitiated: useCallback(() => {}, []),
        onClearance: useCallback(() => {}, []),
    });

    return (
        <View style={s.root}>
            <View style={s.titleBar}>
                <Text style={s.titleText}>支付方式</Text>
            </View>
            <FlatList
                data={sortedPaymentFunctions}
                keyExtractor={(item) => item.key}
                numColumns={3}
                renderItem={renderItem}
                style={s.list}
                contentContainerStyle={s.container}
                columnWrapperStyle={s.columnWrapper}
                showsVerticalScrollIndicator={true}
                persistentScrollbar={Platform.OS === 'android'}
                fadingEdgeLength={Platform.OS === 'android' ? 0 : undefined}
                removeClippedSubviews={true}
                maxToRenderPerBatch={9}
                windowSize={5}
                initialNumToRender={9}
            />
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
        padding: 12,
        backgroundColor: '#F8F9FA',
        borderBottomWidth: 1,
        borderBottomColor: '#E9ECEF',
    },
    titleText: {
        fontSize: 20,
        fontWeight: '600',
        color: '#212529',
    },
    list: {
        flex: 1,
    },
    container: {
        paddingVertical: 8,
    },
    columnWrapper: {
        paddingHorizontal: 8,
    },
});