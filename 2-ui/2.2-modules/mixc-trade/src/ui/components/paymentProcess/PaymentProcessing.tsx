import React from "react";
import {ActivityIndicator, StyleSheet, Text, View} from "react-native";

export const PaymentProcessing: React.FC = React.memo(() => {
    return (
        <View style={styles.container}>
            <ActivityIndicator size="large" color="#2563EB" />
            <Text style={styles.text}>支付处理中...</Text>
        </View>
    );
});

const styles = StyleSheet.create({
    container: {
        alignItems: 'center',
        paddingVertical: 32,
        gap: 16,
    },
    text: {
        fontSize: 16,
        color: '#64748B',
    },
});
