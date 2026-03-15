import React, {useCallback} from "react";
import {useLifecycle} from "@impos2/ui-core-base";
import {View, FlatList, Text, StyleSheet} from "react-native";
import {useSelector} from "react-redux";
import {selectProducts, Product} from "@impos2/kernel-mixc-product";
import {kernelMixcOrderCreateTraditionalCommands, selectProductOrderSessionId} from "@impos2/kernel-mixc-order-create-traditional";
import {ProductSelectionItem} from "./ProductSelectionItem";
import {shortId} from "@impos2/kernel-core-base";

export const ProductSelectionContainer: React.FC = () => {
    const products = useSelector(selectProducts);
    const sessionId = useSelector(selectProductOrderSessionId);

    const handleProductPress = useCallback((product: Product) => {
        kernelMixcOrderCreateTraditionalCommands.addProductOrder(product).execute(shortId(), sessionId);
    }, [sessionId]);

    useLifecycle({
        componentName: 'ProductSelectionContainer',
        onInitiated: useCallback(() => {
        }, []),
        onClearance: useCallback(() => {
        }, []),
    });

    return (
        <View style={styles.wrapper}>
            <Text style={styles.title}>商品列表：{products.length}个</Text>
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
                showsVerticalScrollIndicator={true}
                persistentScrollbar={true}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    wrapper: {
        flex: 1,
    },
    title: {
        fontSize: 20,
        fontWeight: '600',
        color: '#212529',
        padding: 12,
        backgroundColor: '#F8F9FA',
        borderBottomWidth: 1,
        borderBottomColor: '#E9ECEF',
    },
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