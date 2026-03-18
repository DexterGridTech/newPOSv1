import React from "react";
import {ModalScreen} from "@impos2/kernel-core-navigation";
import {StyleSheet, Text, TouchableOpacity, View} from "react-native";
import {usePaymentModal} from "../../hooks";
import {ScreenMode, ScreenPartRegistration} from "@impos2/kernel-core-base";
import {InstanceMode, Workspace} from "@impos2/kernel-core-interconnection";

interface PaymentModalProps {
    title: string;
    mainOrderCode: string;
    paymentFunctionKey: string;
}

export const PaymentModal: React.FC<ModalScreen<PaymentModalProps>> = React.memo((modal) => {
    const {title, mainOrderCode, paymentFunctionKey} = modal.props || {};

    const {handleClose} = usePaymentModal({
        modalId: modal.id,
        mainOrderCode: mainOrderCode || '',
        paymentFunctionKey: paymentFunctionKey || ''
    });

    return (
        <View style={styles.overlay}>
            <View style={styles.backdrop}/>
            <View style={styles.container}>
                <Text style={styles.title}>{title}</Text>
                <View style={styles.content}>
                    <Text style={styles.label}>订单编号：</Text>
                    <Text style={styles.value}>{mainOrderCode}</Text>
                    <Text style={styles.label}>支付方式：</Text>
                    <Text style={styles.value}>{paymentFunctionKey}</Text>
                </View>
                <TouchableOpacity style={styles.button} onPress={handleClose}>
                    <Text style={styles.buttonText}>关闭</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
});

export const paymentModalPart: ScreenPartRegistration = {
    name: 'payment',
    title: '支付',
    description: '支付弹窗',
    partKey: "payment-modal",
    screenMode: [ScreenMode.DESKTOP],
    instanceMode: [InstanceMode.MASTER, InstanceMode.SLAVE],
    workspace: [Workspace.MAIN, Workspace.BRANCH],
    componentType: PaymentModal
};

const styles = StyleSheet.create({
    overlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        justifyContent: 'center',
        alignItems: 'center',
    },
    backdrop: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    container: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 24,
        width: 400,
        shadowColor: '#000',
        shadowOffset: {width: 0, height: 4},
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
    },
    title: {
        fontSize: 20,
        fontWeight: '600',
        color: '#1E293B',
        marginBottom: 16,
    },
    content: {
        marginBottom: 24,
    },
    label: {
        fontSize: 14,
        color: '#64748B',
        marginTop: 8,
    },
    value: {
        fontSize: 16,
        color: '#1E293B',
        fontWeight: '500',
        marginTop: 4,
    },
    button: {
        backgroundColor: '#2563EB',
        borderRadius: 8,
        height: 44,
        justifyContent: 'center',
        alignItems: 'center',
    },
    buttonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
    },
});
