import React, {useCallback} from 'react';
import {Text, View, StyleSheet, Dimensions} from 'react-native';
import {ScreenPartRegistration} from "@impos2/kernel-base";
import {ScreenMode} from "@impos2/kernel-base";
import {useLifecycle} from "../../hooks";

/**
 * 空页面组件 - 企业级设计
 *
 * 职责：
 * 1. 当组件未找到或加载失败时显示
 * 2. 提供友好的错误提示
 * 3. 保持与整体设计系统的一致性
 *
 * 设计系统:
 * - 极简主义风格 (Minimalism)
 * - 企业级配色方案 (Navy/Grey)
 * - 清晰的视觉层次
 * - 友好的错误提示
 */
export const EmptyScreen: React.FC = React.memo(() => {

    useLifecycle({
        isVisible: true,
        componentName: 'EmptyScreen',
        onInitiated: useCallback(() => {
        }, []),
        onClearance: useCallback(() => {
        }, []),
    });

    return (
        <View style={styles.container}>
            <View style={styles.content}>
                {/* 图标区域 */}
                <View style={styles.iconContainer}>
                    <View style={styles.iconCircle}>
                        <Text style={styles.iconText}>!</Text>
                    </View>
                </View>

                {/* 标题 */}
                <Text style={styles.title}>页面未找到</Text>

                {/* 描述 */}
                <Text style={styles.description}>
                    抱歉，此页面暂时无法显示。{'\n'}
                    请检查页面配置或联系技术支持。
                </Text>

                {/* 错误代码 */}
                <View style={styles.errorCodeContainer}>
                    <Text style={styles.errorCode}>ERROR: COMPONENT_NOT_FOUND</Text>
                </View>
            </View>
        </View>
    );
});

// 设计系统常量
const COLORS = {
    primary: '#0F172A',        // Navy 900
    surface: '#FFFFFF',        // White
    text: '#020617',           // Slate 950
    textSecondary: '#64748B',  // Slate 500
    border: '#E2E8F0',         // Slate 200
    warning: '#F59E0B',        // Amber 500
    warningBg: '#FEF3C7',      // Amber 100
    errorBg: '#FEF2F2',        // Red 50
};

const {width, height} = Dimensions.get('window');

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.surface,
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: height * 0.6,
    },
    content: {
        width: '100%',
        maxWidth: 480,
        paddingHorizontal: 32,
        alignItems: 'center',
    },
    iconContainer: {
        marginBottom: 24,
    },
    iconCircle: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: COLORS.warningBg,
        borderWidth: 2,
        borderColor: COLORS.warning,
        justifyContent: 'center',
        alignItems: 'center',
    },
    iconText: {
        fontSize: 40,
        fontWeight: '700',
        color: COLORS.warning,
    },
    title: {
        fontSize: 24,
        fontWeight: '600',
        color: COLORS.text,
        textAlign: 'center',
        marginBottom: 12,
        letterSpacing: -0.5,
    },
    description: {
        fontSize: 15,
        lineHeight: 22,
        color: COLORS.textSecondary,
        textAlign: 'center',
        marginBottom: 24,
        fontWeight: '400',
    },
    errorCodeContainer: {
        backgroundColor: COLORS.errorBg,
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    errorCode: {
        fontSize: 12,
        fontWeight: '500',
        color: COLORS.textSecondary,
        fontFamily: 'monospace',
        letterSpacing: 0.5,
    },
});

export const emptyScreenPart: ScreenPartRegistration = {
    name: 'emptyScreen',
    title: '空白页面',
    description: '默认的空白页面组件',
    partKey: 'empty',
    screenMode: [ScreenMode.DESKTOP, ScreenMode.MOBILE],
    componentType: EmptyScreen
};