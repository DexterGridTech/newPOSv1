import React, {useCallback} from "react";
import {StyleSheet, FlatList, View} from "react-native";
import {useSelector} from "react-redux";
import {selectPayingOrders} from "@impos2/kernel-mixc-order-pay";
import {PayingMainOrder} from "@impos2/kernel-mixc-order-pay";
import {PayingOrderItem} from "./PayingOrderItem";
import {uiMixcTradeCommands} from "../../../features/commands";
import {kernelCoreNavigationCommands, useChildScreenPart} from "@impos2/kernel-core-navigation";
import {payingOrderScreenPart} from "../../screens/PayingOrderScreen";
import {shortId} from "@impos2/kernel-core-base";
import {selectedPayingOrder} from "../../../selectors/selectOrderCreation";
import {uiMixcTradeVariables} from "../../variables";

export const PayingOrderList: React.FC = () => {
    const orders = useSelector(selectPayingOrders);
    const selectedOrderCode = useSelector(selectedPayingOrder);
    const screenPart = useChildScreenPart(uiMixcTradeVariables.mixcTradePanelContainer);

    const handleOrderPress = useCallback((order: PayingMainOrder) => {
        const payingMainOrderCode = order.mainOrderCode;
        uiMixcTradeCommands.setSelectedPayingOrder(payingMainOrderCode!).execute(shortId());
        kernelCoreNavigationCommands.navigateTo({target: payingOrderScreenPart}).execute(shortId());
    }, []);

    const renderItem = useCallback(({item}: {item: PayingMainOrder}) => (
        <PayingOrderItem
            order={item}
            onPress={handleOrderPress}
            isSelected={item.mainOrderCode === selectedOrderCode && screenPart?.partKey === payingOrderScreenPart.partKey}
        />
    ), [handleOrderPress, selectedOrderCode, screenPart]);

    if (orders.length === 0) {
        return null;
    }

    return (
        <View style={s.root}>
            <FlatList
                data={orders}
                keyExtractor={(item) => item.mainOrderCode || ''}
                renderItem={renderItem}
                showsVerticalScrollIndicator={true}
                removeClippedSubviews={true}
                maxToRenderPerBatch={5}
                windowSize={3}
                initialNumToRender={5}
            />
        </View>
    );
};

const s = StyleSheet.create({
    root: {
        backgroundColor: '#F8F9FA',
    },
});