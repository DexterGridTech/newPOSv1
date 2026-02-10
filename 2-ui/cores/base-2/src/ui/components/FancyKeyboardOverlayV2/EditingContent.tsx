import React, {useRef, useEffect} from 'react';
import {View, Text, StyleSheet, Animated, Platform} from 'react-native';
import {ActiveInputInfoV2} from '../../../contexts/FancyKeyboardContextV2';

interface EditingContentProps {
    activeInput: ActiveInputInfoV2 | null;
    shouldShake: boolean;
}

/**
 * EditingContent 组件
 * 显示正在编辑的内容，带闪烁光标和抖动动画
 */
export const EditingContent: React.FC<EditingContentProps> = ({activeInput, shouldShake}) => {
    // 光标闪烁动画
    const cursorOpacity = useRef(new Animated.Value(1)).current;
    // 抖动动画
    const shakeAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (activeInput) {
            // 启动光标闪烁动画
            const blinkAnimation = Animated.loop(
                Animated.sequence([
                    Animated.timing(cursorOpacity, {
                        toValue: 0,
                        duration: 500,
                        useNativeDriver: Platform.OS !== 'web',
                    }),
                    Animated.timing(cursorOpacity, {
                        toValue: 1,
                        duration: 500,
                        useNativeDriver: Platform.OS !== 'web',
                    }),
                ])
            );
            blinkAnimation.start();

            return () => {
                blinkAnimation.stop();
            };
        }
    }, [activeInput, cursorOpacity]);

    // 监听 shouldShake 触发抖动
    useEffect(() => {
        if (shouldShake) {
            const useNative = Platform.OS !== 'web';
            Animated.sequence([
                Animated.timing(shakeAnim, {toValue: 10, duration: 50, useNativeDriver: useNative}),
                Animated.timing(shakeAnim, {toValue: -10, duration: 50, useNativeDriver: useNative}),
                Animated.timing(shakeAnim, {toValue: 10, duration: 50, useNativeDriver: useNative}),
                Animated.timing(shakeAnim, {toValue: 0, duration: 50, useNativeDriver: useNative}),
            ]).start();
        }
    }, [shouldShake, shakeAnim]);

    if (!activeInput) {
        return null;
    }

    const {editingValue, promptText, secureTextEntry} = activeInput;

    // 显示的文本
    const displayText = secureTextEntry ? '•'.repeat(editingValue.length) : editingValue;

    return (
        <View style={styles.container}>
            {/* 提示文本 - 绝对定位在左侧 */}
            {promptText && (
                <View style={styles.promptContainer}>
                    <Text style={styles.promptText}>{promptText}</Text>
                </View>
            )}

            {/* 编辑内容 - 屏幕居中，带抖动动画 */}
            <Animated.View style={[styles.contentContainer, {transform: [{translateX: shakeAnim}]}]}>
                <Text style={styles.editingText}>{displayText}</Text>
                {/* 闪烁光标 */}
                <Animated.View style={[styles.cursor, {opacity: cursorOpacity}]} />
            </Animated.View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        height: 80,
        backgroundColor: '#F8F9FA',
        justifyContent: 'center',
        alignItems: 'center',
        borderBottomWidth: 1,
        borderBottomColor: '#E2E8F0',
        position: 'relative',
    },
    promptContainer: {
        position: 'absolute',
        left: 24,
        top: 0,
        bottom: 0,
        justifyContent: 'center',
    },
    promptText: {
        fontSize: 18,
        fontWeight: '600',
        color: '#64748B',
    },
    contentContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    editingText: {
        fontSize: 28,
        fontWeight: '700',
        color: '#020617',
        letterSpacing: 1,
    },
    cursor: {
        width: 2,
        height: 32,
        backgroundColor: '#020617',
        marginLeft: 2,
    },
});
