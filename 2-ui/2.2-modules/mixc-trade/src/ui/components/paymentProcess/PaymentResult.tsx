import React from "react";
import {StyleSheet, Text, View} from "react-native";
import {IAppError} from "@impos2/kernel-core-base";
import {PaymentRequestStatus} from "@impos2/kernel-pay-base";

interface PaymentResultProps {
    status: PaymentRequestStatus.COMPLETED | PaymentRequestStatus.ERROR;
    errors?: Record<string, IAppError>;
}

export const PaymentResult: React.FC<PaymentResultProps> = React.memo(({status, errors}) => {
    const isSuccess = status === PaymentRequestStatus.COMPLETED;
    const errorMessages = errors ? Object.values(errors) : [];
    return (
        <View style={styles.container}>
            <Text style={[styles.icon, isSuccess ? styles.iconSuccess : styles.iconError]}>
                {isSuccess ? '✓' : '✗'}
            </Text>
            <Text style={[styles.text, isSuccess ? styles.textSuccess : styles.textError]}>
                {isSuccess ? '支付成功' : '支付失败'}
            </Text>
            {!isSuccess && errorMessages.map(err => (
                <Text key={err.key} style={styles.errorMessage}>{err.message}</Text>
            ))}
        </View>
    );
});

const styles = StyleSheet.create({
    container: {
        alignItems: 'center',
        paddingVertical: 32,
        gap: 12,
    },
    icon: {
        fontSize: 48,
        fontWeight: '700',
    },
    iconSuccess: {
        color: '#16A34A',
    },
    iconError: {
        color: '#DC2626',
    },
    text: {
        fontSize: 18,
        fontWeight: '600',
    },
    textSuccess: {
        color: '#16A34A',
    },
    textError: {
        color: '#DC2626',
    },
    errorMessage: {
        fontSize: 13,
        color: '#DC2626',
        textAlign: 'center',
        marginTop: 4,
    },
});
