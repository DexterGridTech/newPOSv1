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

    const renderItem = useCallback(({item}: {item: Product}) => (
        <ProductSelectionItem product={item} onPress={handleProductPress}/>
    ), [handleProductPress]);

    useLifecycle({
        componentName: 'ProductSelectionContainer',
        onInitiated: useCallback(() => {
        }, []),
        onClearance: useCallback(() => {
        }, []),
    });

    return (
        <View style={styles.wrapper}>
            <View style={styles.titleBar}>
                <Text style={styles.title}>商品列表</Text>
                <Text style={styles.countText}>共{products.length}个</Text>
            </View>
            <FlatList
                data={products}
                keyExtractor={(item) => item.productCode}
                numColumns={3}
                renderItem={renderItem}
                style={styles.list}
                contentContainerStyle={styles.container}
                columnWrapperStyle={styles.columnWrapper}
                showsVerticalScrollIndicator={true}
                persistentScrollbar={true}
                removeClippedSubviews={true}
                maxToRenderPerBatch={9}
                windowSize={5}
                initialNumToRender={9}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    wrapper: {
        flex: 1,
    },
    titleBar: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 12,
        backgroundColor: '#F8F9FA',
        borderBottomWidth: 1,
        borderBottomColor: '#E9ECEF',
    },
    title: {
        fontSize: 20,
        fontWeight: '600',
        color: '#212529',
    },
    countText: {
        fontSize: 14,
        color: '#666',
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