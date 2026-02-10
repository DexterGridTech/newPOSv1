import React from 'react';
import {View, Text, Pressable, StyleSheet, ViewStyle, TextStyle, Animated, Platform, Dimensions} from 'react-native';
import {useFancyKeyboardV2} from '../../../hooks/useFancyKeyboardV2';

/**
 * FancyInputV2 Props
 */
export interface FancyInputV2Props {
    value: string;
    onChangeText: (text: string) => void;
    keyboardType?: 'full' | 'number';
    onSubmit?: () => void;
    editable?: boolean;
    placeholder?: string;
    placeholderTextColor?: string;
    secureTextEntry?: boolean;
    style?: ViewStyle;
    textStyle?: TextStyle;
    promptText?: string; // 提示文本
    maxLength?: number; // 最大长度
}

/**
 * FancyInputV2 组件
 * 使用 View + Text 模拟输入框，配合自定义软键盘 V2
 */
export const FancyInputV2: React.FC<FancyInputV2Props> = ({
    value,
    onChangeText,
    keyboardType = 'full',
    onSubmit,
    editable = true,
    placeholder = '',
    placeholderTextColor = '#94A3B8',
    secureTextEntry = false,
    style,
    textStyle,
    promptText,
    maxLength,
}) => {
    const containerRef = React.useRef<View>(null);
    const inputIdRef = React.useRef<string>(Math.random().toString(36).substr(2, 9));
    const {showKeyboard, activeInput, updateInputPosition} = useFancyKeyboardV2();

    // 判断当前输入框是否激活
    const isActive = activeInput?.id === inputIdRef.current;

    // 处理点击事件
    const handlePress = React.useCallback(() => {
        if (!editable) return;

        if (containerRef.current) {
            // 在 Web 环境中，使用 getBoundingClientRect 获取真实位置
            if (Platform.OS === 'web') {
                // 在 Web 环境下，containerRef.current 是一个 React Native 的 View 组件
                // 我们需要获取它的底层 DOM 元素
                // @ts-ignore - React Native Web 会将 ref 映射到 DOM 元素
                const domNode = containerRef.current;

                // 使用 setTimeout 确保 DOM 已经渲染
                setTimeout(() => {
                    try {
                        // @ts-ignore
                        const rect = domNode.getBoundingClientRect?.();
                        if (rect) {
                            showKeyboard(
                                {
                                    id: inputIdRef.current,
                                    value,
                                    editingValue: value,
                                    position: {x: rect.left, y: rect.top, width: rect.width, height: rect.height},
                                    initialPosition: {x: rect.left, y: rect.top, width: rect.width, height: rect.height},
                                    onChangeText,
                                    onSubmit,
                                    promptText,
                                    maxLength,
                                    secureTextEntry,
                                },
                                keyboardType
                            );
                        } else {
                            // 如果无法获取 rect，使用屏幕中间偏下的位置作为后备
                            const screenHeight = Dimensions.get('window').height;
                            const defaultY = screenHeight * 0.6;
                            showKeyboard(
                                {
                                    id: inputIdRef.current,
                                    value,
                                    editingValue: value,
                                    position: {x: 0, y: defaultY, width: 300, height: 50},
                                    initialPosition: {x: 0, y: defaultY, width: 300, height: 50},
                                    onChangeText,
                                    onSubmit,
                                    promptText,
                                    maxLength,
                                    secureTextEntry,
                                },
                                keyboardType
                            );
                        }
                    } catch (error) {
                        console.error('[FancyInputV2] Error getting position:', error);
                        // 出错时使用后备位置
                        const screenHeight = Dimensions.get('window').height;
                        const defaultY = screenHeight * 0.6;
                        showKeyboard(
                            {
                                id: inputIdRef.current,
                                value,
                                editingValue: value,
                                position: {x: 0, y: defaultY, width: 300, height: 50},
                                initialPosition: {x: 0, y: defaultY, width: 300, height: 50},
                                onChangeText,
                                onSubmit,
                                promptText,
                                maxLength,
                                secureTextEntry,
                            },
                            keyboardType
                        );
                    }
                }, 0);
            } else {
                // 原生环境：使用 measure 获取准确位置
                containerRef.current.measure((x, y, width, height, pageX, pageY) => {
                    // 添加容错处理
                    const safePageX = pageX || 0;
                    const safePageY = pageY || 0;
                    const safeWidth = width || 300;
                    const safeHeight = height || 50;

                    showKeyboard(
                        {
                            id: inputIdRef.current,
                            value,
                            editingValue: value,
                            position: {x: safePageX, y: safePageY, width: safeWidth, height: safeHeight},
                            initialPosition: {x: safePageX, y: safePageY, width: safeWidth, height: safeHeight},
                            onChangeText,
                            onSubmit,
                            promptText,
                            maxLength,
                            secureTextEntry,
                        },
                        keyboardType
                    );
                });
            }
        }
    }, [editable, value, keyboardType, onSubmit, showKeyboard, onChangeText, promptText, maxLength, secureTextEntry]);

    // 监听布局变化
    const handleLayout = React.useCallback(() => {
        if (isActive && containerRef.current && Platform.OS !== 'web') {
            // 只在原生环境更新位置，Web 环境不需要
            containerRef.current.measure((x, y, width, height, pageX, pageY) => {
                const safePageX = pageX || 0;
                const safePageY = pageY || 0;
                const safeWidth = width || 300;
                const safeHeight = height || 50;
                updateInputPosition({x: safePageX, y: safePageY, width: safeWidth, height: safeHeight});
            });
        }
    }, [isActive, updateInputPosition]);

    // 处理显示的文本
    const displayText = React.useMemo(() => {
        if (!value) {
            return null;
        }
        if (secureTextEntry) {
            return '•'.repeat(value.length);
        }
        return value;
    }, [value, secureTextEntry]);

    return (
        <Pressable
            onPress={editable ? handlePress : undefined}
            style={[styles.container, style]}
            ref={containerRef}
            onLayout={handleLayout}
        >
            {displayText ? (
                <Text style={[styles.text, textStyle]}>{displayText}</Text>
            ) : (
                <Text style={[styles.placeholder, {color: placeholderTextColor}]}>{placeholder}</Text>
            )}
        </Pressable>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
    },
    text: {
        fontSize: 16,
        fontWeight: '400',
        color: '#020617',
        lineHeight: 24,
    },
    placeholder: {
        fontSize: 16,
        fontWeight: '400',
        lineHeight: 24,
    },
});
