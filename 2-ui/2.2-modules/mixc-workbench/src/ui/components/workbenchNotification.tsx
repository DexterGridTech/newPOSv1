import React, {useCallback, useEffect, useRef, useState} from "react";
import {useLifecycle} from "@impos2/ui-core-base";
import {View, Text, TouchableOpacity, StyleSheet, Animated, Alert, Dimensions} from "react-native";

const notifications = [
    "系统将于今晚22:00进行维护，请提前保存数据",
    "新功能上线：支持扫码支付",
    "本月销售额已突破100万",
    "库存预警：部分商品库存不足",
    "会员日活动：全场8折优惠",
    "新品上架：春季新款已到店",
    "温馨提示：请及时清理过期商品",
    "系统升级通知：新增数据报表功能",
];

const screenWidth = Dimensions.get('window').width;

export const WorkbenchNotification: React.FC = () => {
    const translateX = useRef(new Animated.Value(screenWidth)).current;
    const [contentWidth, setContentWidth] = useState(0);

    useLifecycle({
        componentName: 'WorkbenchNotification',
        onInitiated: useCallback(() => {}, []),
        onClearance: useCallback(() => {}, []),
    });

    useEffect(() => {
        if (contentWidth === 0) return;

        const startAnimation = () => {
            translateX.setValue(screenWidth);
            Animated.timing(translateX, {
                toValue: -contentWidth,
                duration: (screenWidth + contentWidth) * 50,
                useNativeDriver: true,
            }).start(() => {
                startAnimation();
            });
        };

        startAnimation();
    }, [translateX, contentWidth]);

    const handlePress = (text: string) => {
        Alert.alert("提醒详情", text);
    };

    return (
        <View style={styles.container}>
            <Animated.View
                style={[styles.scrollView, {transform: [{translateX}]}]}
                onLayout={(e) => {
                    if (contentWidth === 0) {
                        setContentWidth(e.nativeEvent.layout.width);
                    }
                }}
            >
                {notifications.map((text, index) => (
                    <TouchableOpacity key={index} onPress={() => handlePress(text)}>
                        <Text style={styles.text}>{text}</Text>
                    </TouchableOpacity>
                ))}
            </Animated.View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        height: 40,
        backgroundColor: "#FFF9E6",
        overflow: "hidden",
    },
    scrollView: {
        flexDirection: "row",
        alignItems: "center",
        height: "100%",
    },
    text: {
        fontSize: 14,
        color: "#1890FF",
        textDecorationLine: "underline",
        marginHorizontal: 40,
    },
});