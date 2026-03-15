import React, {useCallback} from "react";
import {useLifecycle} from "@impos2/ui-core-base";
import {Text, Pressable, StyleSheet} from "react-native";
import {Product} from "@impos2/kernel-mixc-product";

interface ProductSelectionItemProps {
    product: Product
    onPress: (product: Product) => void
}

export const ProductSelectionItem: React.FC<ProductSelectionItemProps> = React.memo(({product, onPress}) => {
    useLifecycle({
        componentName: 'ProductSelectionItem',
        onInitiated: useCallback(() => {
        }, []),
        onClearance: useCallback(() => {
        }, []),
    });

    const handlePress = useCallback(() => {
        onPress(product);
    }, [product, onPress]);

    return (
        <Pressable
            style={({pressed}) => [styles.container, pressed && styles.containerPressed]}
            onPress={handlePress}
        >
            <Text style={styles.displayName}>{product.displayName}</Text>
            <Text style={styles.productCode}>{product.productCode}</Text>
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
    productCode: {
        color: '#FFFFFF',
        fontSize: 12,
        marginTop: 4,
        opacity: 0.8,
        textAlign: 'center',
    },
});