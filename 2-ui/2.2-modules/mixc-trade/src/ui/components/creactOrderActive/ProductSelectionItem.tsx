import React, {useCallback} from "react";
import {Text, Pressable, StyleSheet} from "react-native";
import {ProductBase} from "@impos2/kernel-product-base";

interface ProductSelectionItemProps {
    product: ProductBase
    onPress: (product: ProductBase) => void
}

export const ProductSelectionItem: React.FC<ProductSelectionItemProps> = React.memo(({product, onPress}) => {
    const handlePress = useCallback(() => {
        onPress(product);
    }, [product, onPress]);

    return (
        <Pressable
            style={({pressed}) => [styles.container, pressed && styles.containerPressed]}
            onPress={handlePress}
        >
            <Text style={styles.displayName}>{product.displayName}</Text>
            <Text style={styles.saleTypeCode}>{product.saleTypeCode}</Text>
        </Pressable>
    );
});

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#4A90E2',
        borderRadius: 8,
        padding: 16,
        margin: 4,
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: 80,
    },
    containerPressed: {
        opacity: 0.7,
    },
    displayName: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
        textAlign: 'center',
    },
    saleTypeCode: {
        color: '#FFFFFF',
        fontSize: 12,
        marginTop: 4,
        opacity: 0.8,
        textAlign: 'center',
    },
});