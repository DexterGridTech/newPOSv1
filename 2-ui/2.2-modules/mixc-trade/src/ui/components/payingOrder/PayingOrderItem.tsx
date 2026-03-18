import React, {useCallback} from "react";
import {StyleSheet, Text, Pressable} from "react-native";
import {PayingMainOrder} from "@impos2/kernel-pay-base";

interface PayingOrderItemProps {
    order: PayingMainOrder;
    onPress: (order: PayingMainOrder) => void;
    isSelected: boolean;
}

export const PayingOrderItem: React.FC<PayingOrderItemProps> = React.memo(({order, onPress, isSelected}) => {
    const handlePress = useCallback(() => {
        onPress(order);
    }, [order, onPress]);

    return (
        <Pressable
            style={({pressed}) => [
                s.root,
                isSelected && s.selected,
                pressed && s.pressed
            ]}
            onPress={handlePress}
        >
            <Text style={s.amount}>¥{(order.amount || 0).toFixed(2)}</Text>
            <Text style={s.status}>{order.mainOrderStatus || ''}</Text>
        </Pressable>
    );
});

const s = StyleSheet.create({
    root: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 16,
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#E9ECEF',
    },
    selected: {
        backgroundColor: '#D4EDDA',
    },
    pressed: {
        opacity: 0.7,
    },
    amount: {
        fontSize: 16,
        fontWeight: '600',
        color: '#212529',
    },
    status: {
        fontSize: 14,
        color: '#6C757D',
    },
});