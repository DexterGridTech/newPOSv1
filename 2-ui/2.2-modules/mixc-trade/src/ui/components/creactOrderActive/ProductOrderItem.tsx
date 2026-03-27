import React, {useCallback} from "react";
import {Text, View, Pressable, StyleSheet} from "react-native";
import {DraftProductOrder} from "@impos2/kernel-order-create-traditional";
import {kernelOrderCreateTraditionalCommands} from "@impos2/kernel-order-create-traditional";
import {shortId} from "@impos2/kernel-core-base";
import {centsToMoneyString} from "@impos2/kernel-order-base";

interface ProductOrderItermProps {
    order: DraftProductOrder;
    isSelected: boolean;
    sessionId: string;
}

export const ProductOrderItem: React.FC<ProductOrderItermProps> = React.memo(({order, isSelected, sessionId}) => {
    const isAmountZero = (order.amount || 0) === 0;

    const handleDecrease = useCallback(() => {
        kernelOrderCreateTraditionalCommands.decreaseProductOrderQuantity({productId: order.id}).execute(shortId(), sessionId);
    }, [order.id, sessionId]);

    const handleIncrease = useCallback(() => {
        kernelOrderCreateTraditionalCommands.increaseProductOrderQuantity({productId: order.id}).execute(shortId(), sessionId);
    }, [order.id, sessionId]);

    const handleRemove = useCallback(() => {
        kernelOrderCreateTraditionalCommands.removeProductOrder({productId: order.id}).execute(shortId(), sessionId);
    }, [order.id, sessionId]);

    const handleSelectPrice = useCallback(() => {
        kernelOrderCreateTraditionalCommands.selectProductOrder({productId: order.id}).execute(shortId(), sessionId);
    }, [order.id, sessionId]);

    return (
        <View style={styles.row}>
            <View style={styles.nameContainer}>
                <Text style={styles.name}>{order.displayName}</Text>
                <Text style={styles.saleTypeCode}>{order.saleTypeCode}</Text>
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
                    {/* 编辑中显示 moneyString（元字符串），否则 price（分）转元展示 */}
                    {isSelected ? order.moneyString : centsToMoneyString(order.price || 0)}
                </Text>
            </Pressable>
            {/* amount 单位为分，centsToMoneyString 转为元字符串展示 */}
            <Text style={[styles.amount, isAmountZero && styles.amountZero, !isAmountZero && styles.amountNonZero]}>
                {centsToMoneyString(order.amount || 0)}
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
        flex: 0.7,
        justifyContent: 'center',
    },
    saleTypeCode: {
        fontSize: 11,
        color: '#6C757D',
        marginTop: 2,
    },
    quantityContainer: {
        flex: 1,
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
        flex: 0.5,
        backgroundColor: '#FFFFFF',
        paddingVertical: 4,
        paddingHorizontal: 8,
        borderRadius: 4,
        borderWidth: 1,
        borderColor: '#DEE2E6',
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
        flex: 0.7,
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
        flex: 0.5,
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
