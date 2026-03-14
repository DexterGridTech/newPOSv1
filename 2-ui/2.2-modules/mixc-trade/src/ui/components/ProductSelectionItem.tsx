import React, {useCallback} from "react";
import {useLifecycle} from "@impos2/ui-core-base";
import {Text, Pressable, StyleSheet} from "react-native";
import {Product} from "@impos2/kernel-mixc-product";

interface ProductSelectionItemProps {
    product: Product
    onPress: (product: Product) => void
}

export const ProductSelectionItem: React.FC<ProductSelectionItemProps> = ({product, onPress}) => {
    useLifecycle({
        componentName: 'ProductSelectionItem',
        onInitiated: useCallback(() => {
        }, []),
        onClearance: useCallback(() => {
        }, []),
    });

    return (
        <Pressable
            style={({pressed}) => [styles.container, pressed && {opacity: 0.7}]}
            onPress={() => onPress(product)}
        >
            <Text style={styles.text}>{product.displayName}</Text>
        </Pressable>
    );
};

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
    text: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
        textAlign: 'center',
    },
});