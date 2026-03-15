import React, {useCallback} from "react";
import {useLifecycle} from "@impos2/ui-core-base";
import {Text, View, Pressable, StyleSheet} from "react-native";
import {useSelector} from "react-redux";
import {DraftProductOrder, selectSelectedProductOrder, selectProductOrderSessionId} from "@impos2/kernel-mixc-order-create-traditional";
import {kernelMixcOrderCreateTraditionalCommands} from "@impos2/kernel-mixc-order-create-traditional";
import {shortId} from "@impos2/kernel-core-base";

interface ProductOrderItermProps {
    order: DraftProductOrder;
}

export const ProductOrderItem: React.FC<ProductOrderItermProps> = React.memo(({order}) => {
    const selectedProductOrderId = useSelector(selectSelectedProductOrder);
    const sessionId = useSelector(selectProductOrderSessionId);
    const isSelected = selectedProductOrderId === order.id;
    const isAmountZero = (order.amount || 0) === 0;

    useLifecycle({
        componentName: 'ProductOrderItem',
        onInitiated: useCallback(() => {}, []),
        onClearance: useCallback(() => {}, []),
    });

    const handleDecrease = useCallback(() => {
        kernelMixcOrderCreateTraditionalCommands.decreaseProductOrderQuantity({productId: order.id}).execute(shortId(), sessionId);
    }, [order.id, sessionId]);

    const handleIncrease = useCallback(() => {
        kernelMixcOrderCreateTraditionalCommands.increaseProductOrderQuantity({productId: order.id}).execute(shortId(), sessionId);
    }, [order.id, sessionId]);

    const handleRemove = useCallback(() => {
        kernelMixcOrderCreateTraditionalCommands.removeProductOrder({productId: order.id}).execute(shortId(), sessionId);
    }, [order.id, sessionId]);

    const handleSelectPrice = useCallback(() => {
        kernelMixcOrderCreateTraditionalCommands.selectProductOrder({productId: order.id}).execute(shortId(), sessionId);
    }, [order.id, sessionId]);

    return (
        <View style={styles.row}>
            <View style={styles.nameContainer}>
                <Text style={styles.name}>{order.displayName}</Text>
                <Text style={styles.productCode}>{order.productCode}</Text>
            </View>
            <View style={styles.quantityContainer}>
                <Pressable
                    style={({pressed}) => [styles.button, pressed && styles.buttonPressed]}
                    onPress={handleDecrease}
                >
                    <Text style={styles.buttonText}>-</Text>
                </Pressable>
                <Text style={styles.quantity}>{order.quantity || 0}</Text>
                <Pressable
                    style={({pressed}) => [styles.button, pressed && styles.buttonPressed]}
                    onPress={handleIncrease}
                >
                    <Text style={styles.buttonText}>+</Text>
                </Pressable>
            </View>
            <Pressable
                style={[styles.priceContainer, isSelected && styles.priceContainerSelected]}
                onPress={handleSelectPrice}
            >
                <Text style={[styles.price, isSelected && styles.priceSelected]}>
                    {isSelected ? order.valueStr : (order.price || 0).toFixed(2)}
                </Text>
            </Pressable>
            <Text style={[styles.amount, isAmountZero && styles.amountZero, !isAmountZero && styles.amountNonZero]}>
                {(order.amount || 0).toFixed(2)}
            </Text>
            <Pressable
                style={({pressed}) => [styles.deleteButton, pressed && styles.deleteButtonPressed]}
                onPress={handleRemove}
            >
                <Text style={styles.deleteText}>删除</Text>
            </Pressable>
        </View>
    );
});

const styles = StyleSheet.create({
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#E9ECEF',
    },
    name: {
        fontSize: 14,
    },
    nameContainer: {
        flex: 2,
        justifyContent: 'center',
    },
    productCode: {
        fontSize: 11,
        color: '#6C757D',
        marginTop: 2,
    },
    quantityContainer: {
        flex: 2,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    button: {
        width: 36,
        height: 36,
        backgroundColor: '#4A90E2',
        borderRadius: 4,
        justifyContent: 'center',
        alignItems: 'center',
    },
    buttonPressed: {
        opacity: 0.7,
    },
    buttonText: {
        color: '#FFFFFF',
        fontSize: 18,
        fontWeight: '600',
    },
    quantity: {
        marginHorizontal: 12,
        fontSize: 14,
        minWidth: 30,
        textAlign: 'center',
    },
    priceContainer: {
        flex: 1,
        backgroundColor: '#FFFFFF',
        paddingVertical: 4,
        paddingHorizontal: 8,
        borderRadius: 4,
        justifyContent: 'center',
        alignItems: 'flex-end',
    },
    priceContainerSelected: {
        backgroundColor: '#D4EDDA',
    },
    price: {
        fontSize: 14,
        textAlign: 'right',
    },
    priceSelected: {
        fontWeight: '600',
    },
    amount: {
        flex: 1,
        fontSize: 14,
        textAlign: 'right',
    },
    amountZero: {
        color: '#ADB5BD',
        fontStyle: 'italic',
    },
    amountNonZero: {
        fontWeight: '700',
        color: '#000000',
    },
    deleteButton: {
        flex: 1,
        alignItems: 'center',
    },
    deleteButtonPressed: {
        opacity: 0.7,
    },
    deleteText: {
        color: '#DC3545',
        fontSize: 14,
    },
});
