import React, {useCallback, useMemo} from "react";
import {useLifecycle} from "@impos2/ui-core-base";
import {StyleSheet, Text, View, FlatList, Platform} from "react-native";
import {PayingMainOrder} from "@impos2/kernel-pay-base";

interface OrderInfoProps {
    order?: PayingMainOrder;
}

export const OrderInfo: React.FC<OrderInfoProps> = ({order}) => {
    useLifecycle({
        componentName: 'OrderInfo',
        onInitiated: useCallback(() => {
        }, []),
        onClearance: useCallback(() => {
        }, []),
    });

    const productOrders = useMemo(() =>
        order?.subOrders?.flatMap(sub => sub.productOrders || []) || [],
        [order]
    );
    const totalAmount = useMemo(() => order?.amount || 0, [order]);

    const renderItem = useCallback(({item, index}: {item: any; index: number}) => (
        <View style={s.item}>
            <Text style={s.index}>{index + 1}</Text>
            <View style={s.productInfo}>
                <Text style={s.productName}>{item.displayName}</Text>
                <Text style={s.saleTypeCode}>{item.saleTypeCode}</Text>
            </View>
            <Text style={s.quantity}>x{item.quantity}</Text>
            <Text style={s.amount}>¥{item.amount.toFixed(2)}</Text>
        </View>
    ), []);

    const footerComponent = useMemo(() => (
        <View style={s.footer}>
            <View style={s.footerRow}>
                <Text style={s.totalLabel}>订单总金额</Text>
                <Text style={s.totalAmount}>¥{totalAmount.toFixed(2)}</Text>
            </View>
            <View style={s.footerRow}>
                <Text style={s.pendingLabel}>待支付金额</Text>
                <Text style={s.pendingAmount}>¥{totalAmount.toFixed(2)}</Text>
            </View>
        </View>
    ), [totalAmount]);

    return (
        <View style={s.root}>
            <View style={s.titleBar}>
                <Text style={s.titleText}>订单信息</Text>
                <Text style={s.countText}>共{productOrders.length}项</Text>
            </View>
            <FlatList
                style={s.list}
                data={productOrders}
                keyExtractor={(item) => item.productOrderCode}
                renderItem={renderItem}
                showsVerticalScrollIndicator={true}
                persistentScrollbar={Platform.OS === 'android'}
                fadingEdgeLength={Platform.OS === 'android' ? 0 : undefined}
            />
            {footerComponent}
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
        borderBottomWidth: 1,
        borderBottomColor: '#E0E0E0',
    },
    titleText: {
        fontSize: 20,
        fontWeight: '600',
        color: '#212529',
    },
    countText: {
        fontSize: 14,
        color: '#666',
    },
    list: {
        flex: 1,
    },
    item: {
        flexDirection: 'row',
        padding: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#F0F0F0',
        alignItems: 'center',
    },
    index: {
        width: 30,
        fontSize: 14,
        color: '#666',
        textAlign: 'center',
    },
    productInfo: {
        flex: 1,
    },
    productName: {
        fontSize: 14,
        color: '#333',
        fontWeight: '700',
    },
    saleTypeCode: {
        fontSize: 12,
        color: '#999',
        marginTop: 2,
    },
    quantity: {
        width: 60,
        fontSize: 14,
        color: '#666',
        textAlign: 'center',
    },
    amount: {
        width: 80,
        fontSize: 14,
        color: '#333',
        textAlign: 'right',
        fontWeight: '500',
    },
    footer: {
        padding: 12,
        backgroundColor: '#F8F9FA',
        borderTopWidth: 1,
        borderTopColor: '#E0E0E0',
    },
    footerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    totalLabel: {
        fontSize: 16,
        fontWeight: '600',
        color: '#212529',
    },
    totalAmount: {
        fontSize: 18,
        fontWeight: '700',
        color: '#333',
    },
    pendingLabel: {
        fontSize: 16,
        fontWeight: '600',
        color: '#212529',
    },
    pendingAmount: {
        fontSize: 18,
        fontWeight: '700',
        color: '#E74C3C',
    },
});