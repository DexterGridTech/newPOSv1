import React, {useCallback} from "react";
import {useLifecycle} from "@impos2/ui-core-base";
import {FlatList, StyleSheet} from "react-native";
import {useSelector} from "react-redux";
import {selectProducts, Product} from "@impos2/kernel-mixc-product";
import {kernelMixcOrderCreateTraditionalCommands} from "@impos2/kernel-mixc-order-create-traditional";
import {ProductSelectionItem} from "./ProductSelectionItem";
import {shortId} from "@impos2/kernel-core-base";

export const ProductSelectionContainer: React.FC = () => {
    const products = useSelector(selectProducts);

    const handleProductPress = useCallback((product: Product) => {
        kernelMixcOrderCreateTraditionalCommands.addProductOrder(product).execute(shortId());
    }, []);

    useLifecycle({
        componentName: 'ProductSelectionContainer',
        onInitiated: useCallback(() => {
        }, []),
        onClearance: useCallback(() => {
        }, []),
    });

    return (
        <FlatList
            data={products}
            keyExtractor={(item) => item.productCode}
            numColumns={3}
            renderItem={({item}) => (
                <ProductSelectionItem product={item} onPress={handleProductPress}/>
            )}
            style={styles.list}
            contentContainerStyle={styles.container}
            columnWrapperStyle={styles.columnWrapper}
        />
    );
};

const styles = StyleSheet.create({
    list: {
        flex: 1,
    },
    container: {
        paddingVertical: 8,
    },
    columnWrapper: {
        paddingHorizontal: 8,
    },
});