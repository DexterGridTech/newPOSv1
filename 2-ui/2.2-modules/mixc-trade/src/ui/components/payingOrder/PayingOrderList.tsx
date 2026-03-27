import React, {useCallback} from "react";
import {StyleSheet, View} from "react-native";
import {useSelector} from "react-redux";
import {selectPayingOrders} from "@impos2/kernel-pay-base";
import {PayingMainOrder} from "@impos2/kernel-pay-base";
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

    if (orders.length === 0) {
        return null;
    }

    return (
        <View style={s.root}>
            {orders.map((item) => (
                <PayingOrderItem
                    key={item.mainOrderCode || ''}
                    order={item}
                    onPress={handleOrderPress}
                    isSelected={item.mainOrderCode === selectedOrderCode && screenPart?.partKey === payingOrderScreenPart.partKey}
                />
            ))}
        </View>
    );
};

const s = StyleSheet.create({
    root: {
        backgroundColor: '#F8F9FA',
    },
});