import React from "react";
import {
    CloseModalCommand,
    ModalScreen,
    ScreenPartRegistration
} from "@impos2/kernel-base";
import {ScreenMode} from "@impos2/kernel-base";
import {nanoid} from "@reduxjs/toolkit";
import {View, Text, TouchableOpacity, StyleSheet, Animated} from 'react-native';

export interface TestModalProps {
    name: string
}

/**
 * 抽屉菜单组件 - 企业级设计
 */
export const TestModal: React.FC<ModalScreen<TestModalProps>> = (model) => {
    const slideAnim = React.useRef(new Animated.Value(-280)).current;
    const opacityAnim = React.useRef(new Animated.Value(0)).current;
    const [isVisible, setIsVisible] = React.useState(false);

    React.useEffect(() => {
        if (model.open) {
            setIsVisible(true);
            Animated.parallel([
                Animated.timing(slideAnim, {
                    toValue: 0,
                    duration: 250,
                    useNativeDriver: true,
                }),
                Animated.timing(opacityAnim, {
                    toValue: 1,
                    duration: 250,
                    useNativeDriver: true,
                }),
            ]).start();
        } else if (isVisible) {
            Animated.parallel([
                Animated.timing(slideAnim, {
                    toValue: -280,
                    duration: 200,
                    useNativeDriver: true,
                }),
                Animated.timing(opacityAnim, {
                    toValue: 0,
                    duration: 200,
                    useNativeDriver: true,
                }),
            ]).start(() => {
                setIsVisible(false);
            });
        }
    }, [model.open, isVisible, slideAnim, opacityAnim]);

    if (!isVisible) {
        return null;
    }

    const closeDrawer = () => {
        new CloseModalCommand({modelId: model.id}).executeFromRequest(nanoid(8));
    };

    return (
        <View style={styles.overlay}>
            <TouchableOpacity
                style={styles.backdrop}
                activeOpacity={1}
                onPress={closeDrawer}
            >
                <Animated.View style={[styles.backdropAnimated, { opacity: opacityAnim }]} />
            </TouchableOpacity>

            <Animated.View
                style={[
                    styles.drawer,
                    { transform: [{ translateX: slideAnim }] }
                ]}
            >
                <View style={styles.header}>
                    <View style={styles.logoBox}>
                        <Text style={styles.logoText}>IM</Text>
                    </View>
                    <Text style={styles.title}>菜单</Text>
                </View>

                <View style={styles.divider} />

                <View style={styles.menuItems}>
                    <TouchableOpacity
                        style={styles.item}
                        onPress={() => console.log('home')}
                        activeOpacity={0.7}
                        accessibilityLabel="首页"
                        accessibilityRole="button"
                    >
                        <Text style={styles.itemText}>首页</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.item}
                        onPress={() => console.log('setting')}
                        activeOpacity={0.7}
                        accessibilityLabel="设置"
                        accessibilityRole="button"
                    >
                        <Text style={styles.itemText}>设置</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.item}
                        onPress={closeDrawer}
                        activeOpacity={0.7}
                        accessibilityLabel="关于"
                        accessibilityRole="button"
                    >
                        <Text style={styles.itemText}>关于</Text>
                    </TouchableOpacity>
                </View>
            </Animated.View>
        </View>
    );
}

// 设计系统常量
const COLORS = {
    primary: '#0F172A',
    surface: '#FFFFFF',
    text: '#020617',
    textSecondary: '#475569',
    border: '#E2E8F0',
    overlay: 'rgba(0, 0, 0, 0.5)',
};

const styles = StyleSheet.create({
    overlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
    },
    backdrop: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 1,
    },
    backdropAnimated: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: COLORS.overlay,
    },
    drawer: {
        position: 'absolute',
        left: 0,
        top: 0,
        bottom: 0,
        width: 280,
        backgroundColor: COLORS.surface,
        shadowColor: COLORS.primary,
        shadowOffset: {
            width: 2,
            height: 0,
        },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 8,
        zIndex: 2,
    },
    header: {
        padding: 24,
        paddingTop: 32,
    },
    logoBox: {
        width: 48,
        height: 48,
        backgroundColor: COLORS.primary,
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 12,
    },
    logoText: {
        fontSize: 20,
        fontWeight: '700',
        color: COLORS.surface,
        letterSpacing: 1,
    },
    title: {
        fontSize: 18,
        fontWeight: '600',
        color: COLORS.text,
        letterSpacing: -0.3,
    },
    divider: {
        height: 1,
        backgroundColor: COLORS.border,
        marginHorizontal: 16,
        marginBottom: 8,
    },
    menuItems: {
        paddingHorizontal: 8,
    },
    item: {
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderRadius: 8,
        marginBottom: 4,
    },
    itemText: {
        fontSize: 15,
        fontWeight: '500',
        color: COLORS.textSecondary,
        letterSpacing: 0.1,
    },
});

export const testModalScreenPart: ScreenPartRegistration = {
    name: 'testModal',
    title: '测试弹窗',
    description: '用于测试的弹窗组件',
    partKey: 'testModal',
    containerKey: '',
    screenMode: [ScreenMode.DESKTOP,ScreenMode.MOBILE],
    componentType: TestModal
}
