import React from "react";
import {ModalScreen} from "@impos2/kernel-core-navigation";
import {StyleSheet, Text, TouchableOpacity, View} from "react-native";
import {usePaymentModal} from "../../hooks/usePaymentModal";
import {ScreenMode, ScreenPartRegistration} from "@impos2/kernel-core-base";
import {InstanceMode, Workspace} from "@impos2/kernel-core-interconnection";
import {PaymentAmountType, PaymentRequestStatus} from "@impos2/kernel-pay-base";
import {AmountConfirmKeyboard} from "../components/paymentProcess/AmountConfirmKeyboard";
import {PaymentProcessing} from "../components/paymentProcess/PaymentProcessing";
import {PaymentResult} from "../components/paymentProcess/PaymentResult";

interface PaymentModalProps {
    title: string;
    paymentRequestCode: string;
}

const usePaymentContent = (
    paymentRequestStatus: PaymentRequestStatus | undefined,
    paymentAmountType: PaymentAmountType | undefined,
    amount: number,
) => {
    if (!paymentRequestStatus || !paymentAmountType) return null;

    if (
        paymentRequestStatus === PaymentRequestStatus.CREATED &&
        paymentAmountType === PaymentAmountType.FIXED
    ) {
        return <AmountConfirmKeyboard maxAmount={amount} />;
    }

    if (
        (paymentRequestStatus === PaymentRequestStatus.CREATED &&
            paymentAmountType === PaymentAmountType.DYNAMIC) ||
        paymentRequestStatus === PaymentRequestStatus.PENDING
    ) {
        return <PaymentProcessing />;
    }

    if (
        paymentRequestStatus === PaymentRequestStatus.COMPLETED ||
        paymentRequestStatus === PaymentRequestStatus.ERROR
    ) {
        return <PaymentResult status={paymentRequestStatus} />;
    }

    return null;
};

export const PaymentModal: React.FC<ModalScreen<PaymentModalProps>> = React.memo((modal) => {
    const {title, paymentRequestCode} = modal.props || {};

    const {handleCloseAndRemove, paymentRequest, paymentFunction} = usePaymentModal({
        modalId: modal.id,
        paymentRequestCode: paymentRequestCode!,
    });

    const content = usePaymentContent(
        paymentRequest?.paymentRequestStatus,
        paymentFunction?.definition.paymentAmountType,
        paymentRequest?.amount ?? 0,
    );

    return (
        <View style={styles.overlay}>
            <View style={styles.backdrop} />
            <View style={styles.container}>
                <View style={styles.header}>
                    <View style={styles.headerAccent} />
                    <View style={styles.headerTextGroup}>
                        <Text style={styles.headerLabel}>收款</Text>
                        <Text style={styles.title}>{title}</Text>
                    </View>
                </View>
                <View style={styles.divider} />
                <View style={styles.content}>
                    {content}
                </View>
                <TouchableOpacity style={styles.button} onPress={handleCloseAndRemove}>
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
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginBottom: 16,
    },
    headerAccent: {
        width: 4,
        height: 36,
        borderRadius: 2,
        backgroundColor: '#2563EB',
    },
    headerTextGroup: {
        gap: 2,
    },
    headerLabel: {
        fontSize: 11,
        fontWeight: '600',
        color: '#2563EB',
        letterSpacing: 1.2,
        textTransform: 'uppercase',
    },
    title: {
        fontSize: 20,
        fontWeight: '700',
        color: '#0F172A',
        letterSpacing: -0.3,
    },
    divider: {
        height: 1,
        backgroundColor: '#E2E8F0',
        marginBottom: 16,
    },
    content: {
        marginBottom: 16,
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
