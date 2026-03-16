import React, {useCallback, useEffect, useMemo} from "react";
import {useLifecycle} from "@impos2/ui-core-base";
import {Text, View, Pressable, StyleSheet} from "react-native";
import {useSelector} from "react-redux";
import {
    kernelMixcOrderCreateTraditionalCommands,
    selectProductOrderTotalAmount,
    selectProductOrderSessionId, selectDraftProductOrders
} from "@impos2/kernel-mixc-order-create-traditional";
import {LOG_TAGS, logger, shortId} from "@impos2/kernel-core-base";
import {uiMixcTradeCommands} from "../../../features/commands";
import {selectSlaveConnected, getEnableSlave, useRequestStatus} from "@impos2/kernel-core-interconnection";
import {kernelMixcOrderPayCommands} from "@impos2/kernel-mixc-order-pay";
import {moduleName} from "../../../moduleName";
import {kernelCoreNavigationCommands} from "@impos2/kernel-core-navigation";
import {payingOrderScreenPart} from "../../screens/PayingOrderScreen";

export const OrderPriceConfirmContainer: React.FC = () => {
    const totalAmount = useSelector(selectProductOrderTotalAmount) || 0;
    const draftProductOrders = useSelector(selectDraftProductOrders) || [];
    const sessionId = useSelector(selectProductOrderSessionId);
    const slaveConnected = useSelector(selectSlaveConnected);
    const enableSlave = useMemo(() => getEnableSlave(), []);
    const [requestId, setRequestId] = React.useState<string | null>(null);
    const handledRef = React.useRef<string | null>(null);
    const settleStatus = useRequestStatus(requestId);

    useEffect(() => {
        if (settleStatus?.status === 'complete' && requestId && handledRef.current !== requestId) {
            handledRef.current = requestId;
            const payingMainOrderCode = settleStatus.results?.payingMainOrderCode;
            kernelMixcOrderCreateTraditionalCommands.clearProductOrder().execute(shortId(),sessionId);
            uiMixcTradeCommands.setSelectedPayingOrder(payingMainOrderCode).execute(shortId(),sessionId);
            kernelCoreNavigationCommands.navigateTo({target:payingOrderScreenPart}).execute(shortId(),sessionId);
        } else if (settleStatus?.status === 'error' && requestId && handledRef.current !== requestId) {
            handledRef.current = requestId;
            logger.log([moduleName, LOG_TAGS.UI, 'OrderPriceConfirmContainer'], '结算失败:', settleStatus.errors);
        }
    }, [settleStatus?.status, requestId,sessionId]);

    useLifecycle({
        componentName: 'OrderPriceConfirmContainer',
        onInitiated: useCallback(() => {}, []),
        onClearance: useCallback(() => {}, []),
    });

    const handleCodePlateOrder = useCallback(() => {
        uiMixcTradeCommands.setOrderCreationTypeToPassive().execute(shortId(), sessionId);
    }, [sessionId]);

    const handlePresaleOrder = useCallback(() => {
        console.log('预售订单 clicked');
    }, []);

    const handleClear = useCallback(() => {
        kernelMixcOrderCreateTraditionalCommands.clearProductOrder().execute(shortId(), sessionId);
    }, [sessionId]);

    const handleSettle = useCallback(() => {
        if (settleStatus?.status === 'started') return;
        const id = shortId();
        setRequestId(id);
        kernelMixcOrderPayCommands.addPayingOrderFromDraft(draftProductOrders).execute(id, sessionId);
    }, [settleStatus?.status, draftProductOrders, sessionId]);

    return (
        <View style={styles.container}>
            <View style={styles.titleBar}>
                <Text style={styles.titleText}>开单确认</Text>
                {enableSlave && (
                    <Pressable
                        style={({pressed}) => [
                            styles.codePlateButton,
                            !slaveConnected && styles.codePlateButtonDisabled,
                            pressed && slaveConnected && styles.buttonPressed,
                        ]}
                        onPress={handleCodePlateOrder}
                        disabled={!slaveConnected}
                    >
                        <Text style={[
                            styles.codePlateButtonText,
                            !slaveConnected && styles.codePlateButtonTextDisabled
                        ]}>码牌收单</Text>
                    </Pressable>
                )}
            </View>

            <View style={styles.presaleSection}>
                <Pressable
                    style={({pressed}) => [
                        styles.presaleButton,
                        pressed && styles.buttonPressed,
                    ]}
                    onPress={handlePresaleOrder}
                >
                    <Text style={styles.presaleButtonText}>预售订单</Text>
                </Pressable>
            </View>

            <View style={styles.amountSection}>
                <Text style={styles.amountValue}>¥{totalAmount.toFixed(2)}</Text>
            </View>

            <View style={styles.actionSection}>
                <Pressable
                    style={({pressed}) => [
                        styles.actionButton,
                        styles.clearButton,
                        pressed && styles.buttonPressed,
                    ]}
                    onPress={handleClear}
                >
                    <Text style={styles.clearButtonText}>清空</Text>
                </Pressable>
                <Pressable
                    style={({pressed}) => [
                        styles.actionButton,
                        styles.settleButton,
                        totalAmount === 0 && styles.settleButtonDisabled,
                        pressed && totalAmount > 0 && styles.buttonPressed,
                    ]}
                    onPress={handleSettle}
                    disabled={totalAmount === 0}
                >
                    <Text style={[
                        styles.settleButtonText,
                        totalAmount === 0 && styles.settleButtonTextDisabled,
                    ]}>
                        结算
                    </Text>
                </Pressable>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8F9FA',
    },
    titleBar: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 8,
    },
    titleText: {
        fontSize: 20,
        fontWeight: '600',
        color: '#212529',
    },
    codePlateButton: {
        paddingHorizontal: 20,
        paddingVertical: 10,
        backgroundColor: '#FFFFFF',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#4A90E2',
        shadowColor: '#000',
        shadowOffset: {width: 0, height: 2},
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    codePlateButtonDisabled: {
        backgroundColor: '#E9ECEF',
        borderColor: '#DEE2E6',
        shadowOpacity: 0,
        elevation: 0,
    },
    codePlateButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#4A90E2',
    },
    codePlateButtonTextDisabled: {
        color: '#ADB5BD',
    },
    presaleSection: {
        paddingHorizontal: 8,
        paddingVertical: 5,
    },
    presaleButton: {
        paddingVertical: 14,
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        borderWidth: 2,
        borderColor: '#4A90E2',
        alignItems: 'center',
    },
    presaleButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#4A90E2',
    },
    amountSection: {
        flex: 1,
        backgroundColor: '#FFFFFF',
        justifyContent: 'center',
        alignItems: 'center',
        marginHorizontal: 8,
        marginVertical: 5,
        borderRadius: 12,
    },
    amountValue: {
        fontSize: 36,
        fontWeight: '700',
        color: '#212529',
    },
    actionSection: {
        flexDirection: 'row',
        gap: 8,
        paddingHorizontal: 8,
        paddingBottom: 8,
        paddingTop: 5,
    },
    actionButton: {
        flex: 1,
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    clearButton: {
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#DEE2E6',
    },
    clearButtonText: {
        fontSize: 18,
        fontWeight: '600',
        color: '#212529',
    },
    settleButton: {
        backgroundColor: '#4A90E2',
    },
    settleButtonDisabled: {
        backgroundColor: '#E9ECEF',
        shadowOpacity: 0,
        elevation: 0,
    },
    settleButtonText: {
        fontSize: 18,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    settleButtonTextDisabled: {
        color: '#ADB5BD',
    },
    buttonPressed: {
        transform: [{scale: 0.98}],
        opacity: 0.9,
    },
});