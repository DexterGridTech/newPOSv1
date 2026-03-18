import React from "react";
import {TouchableOpacity, Text, StyleSheet} from "react-native";
import {PaymentFunction} from "@impos2/kernel-pay-base";

interface PaymentFunctionItemProps {
    paymentFunction: PaymentFunction;
    onPress: (paymentFunction: PaymentFunction) => void;
}

export const PaymentFunctionItem: React.FC<PaymentFunctionItemProps> = ({paymentFunction, onPress}) => {
    return (
        <TouchableOpacity
            style={styles.item}
            onPress={() => onPress(paymentFunction)}
            activeOpacity={0.7}
        >
            <Text style={styles.text}>{paymentFunction.displayName}</Text>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    item: {
        flex: 1,
        margin: 4,
        padding: 16,
        backgroundColor: '#FFFFFF',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#E9ECEF',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 60,
    },
    text: {
        fontSize: 16,
        color: '#212529',
        textAlign: 'center',
    },
});
