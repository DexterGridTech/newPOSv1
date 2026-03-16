import React, {useCallback, useRef, useEffect} from "react";
import {useLifecycle} from "@impos2/ui-core-base";
import {Text, View, FlatList, StyleSheet} from "react-native";
import {useSelector} from "react-redux";
import {selectDraftProductOrders, selectSelectedProductOrder, selectProductOrderSessionId} from "@impos2/kernel-mixc-order-create-traditional";
import {ProductOrderItem} from "./ProductOrderItem";

export const ProductOrderContainer: React.FC = () => {
    const orders = useSelector(selectDraftProductOrders);
    const selectedProductOrderId = useSelector(selectSelectedProductOrder);
    const sessionId = useSelector(selectProductOrderSessionId);
    const flatListRef = useRef<FlatList>(null);

    useLifecycle({
        componentName: 'ProductOrderContainer',
        onInitiated: useCallback(() => {}, []),
        onClearance: useCallback(() => {}, []),
    });

    useEffect(() => {
        if (selectedProductOrderId && selectedProductOrderId.length > 0) {
            const index = orders.findIndex(order => order.id === selectedProductOrderId);
            if (index !== -1) {
                flatListRef.current?.scrollToIndex({
                    index,
                    animated: true,
                    viewPosition: 0.5,
                });
            }
        }
    }, [selectedProductOrderId, orders]);

    const getItemLayout = useCallback((data: any, index: number) => ({
        length: 73,
        offset: 73 * index,
        index,
    }), []);

    const renderItem = useCallback(({item}: {item: any}) => (
        <ProductOrderItem order={item} isSelected={item.id === selectedProductOrderId} sessionId={sessionId} />
    ), [selectedProductOrderId, sessionId]);

    return (
        <View style={styles.wrapper}>
            <Text style={styles.title}>已选择：{orders.length}个</Text>
            <View style={styles.header}>
                <Text style={styles.headerName}>商品名称</Text>
                <Text style={styles.headerQuantity}>数量</Text>
                <Text style={styles.headerPrice}>单价</Text>
                <Text style={styles.headerAmount}>总价</Text>
                <Text style={styles.headerDelete}></Text>
            </View>
            <View style={styles.listContainer}>
                <FlatList
                    ref={flatListRef}
                    data={orders}
                    keyExtractor={(order) => order.id}
                    renderItem={renderItem}
                    getItemLayout={getItemLayout}
                    showsVerticalScrollIndicator={true}
                    persistentScrollbar={true}
                    keyboardShouldPersistTaps="handled"
                    scrollEventThrottle={16}
                    removeClippedSubviews={true}
                    maxToRenderPerBatch={10}
                    windowSize={5}
                    initialNumToRender={10}
                    contentContainerStyle={styles.listContent}
                    onScrollToIndexFailed={(info) => {
                        setTimeout(() => {
                            flatListRef.current?.scrollToIndex({
                                index: info.index,
                                animated: true,
                                viewPosition: 0.5,
                            });
                        }, 100);
                    }}
                />
            </View>
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
    header: {
        flexDirection: 'row',
        paddingVertical: 12,
        paddingHorizontal: 16,
        backgroundColor: '#F8F9FA',
        borderBottomWidth: 2,
        borderBottomColor: '#DEE2E6',
    },
    headerName: {
        flex: 1,
        fontSize: 14,
        fontWeight: '600',
    },
    headerQuantity: {
        flex: 1,
        fontSize: 14,
        fontWeight: '600',
        textAlign: 'center',
    },
    headerPrice: {
        flex: 1,
        fontSize: 14,
        fontWeight: '600',
        textAlign: 'right',
    },
    headerAmount: {
        flex: 1,
        fontSize: 14,
        fontWeight: '600',
        textAlign: 'right',
    },
    headerDelete: {
        flex: 1,
        fontSize: 14,
        fontWeight: '600',
        textAlign: 'center',
    },
    listContainer: {
        flex: 1,
        minHeight: 0,
    },
    listContent: {
        flexGrow: 1,
    },
});
