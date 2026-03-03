import React, {memo, useContext} from 'react';
import {View, Text, Pressable, StyleSheet, ViewStyle, TextStyle, Animated, Platform, Dimensions} from 'react-native';
import {FancyKeyboardActionsContextV2, FancyKeyboardDisplayContextV2} from '../../../contexts/FancyKeyboardContextV2';

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
export const FancyInputV2: React.FC<FancyInputV2Props> = memo(({
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
    // 订阅 split contexts：actions 稳定不变，display 只在 activeInput 变化时触发重渲染
    const actions = useContext(FancyKeyboardActionsContextV2);
    const display = useContext(FancyKeyboardDisplayContextV2);
    const showKeyboard = actions?.showKeyboard;
    const updateInputPosition = actions?.updateInputPosition;
    const activeInput = display?.activeInput ?? null;

    // 动画值：用于字体缩放
    const scaleAnim = React.useRef(new Animated.Value(1)).current;

    // 用于防止重复点击
    const isProcessingRef = React.useRef(false);

    // 使用 ref 存储稳定的回调和 value，避免 handlePress 依赖 value 导致频繁重建
    const onChangeTextRef = React.useRef(onChangeText);
    const onSubmitRef = React.useRef(onSubmit);
    const valueRef = React.useRef(value);

    React.useEffect(() => {
        onChangeTextRef.current = onChangeText;
        onSubmitRef.current = onSubmit;
        valueRef.current = value;
    }, [onChangeText, onSubmit, value]);

    // 判断当前输入框是否激活
    const isActive = activeInput?.id === inputIdRef.current;

    const handlePressIn = React.useCallback(() => {
        if (!editable) return;
        Animated.spring(scaleAnim, {toValue: 1.1, useNativeDriver: true, friction: 5, tension: 100}).start();
    }, [editable]);

    const handlePressOut = React.useCallback(() => {
        if (!editable) return;
        Animated.spring(scaleAnim, {toValue: 1, useNativeDriver: true, friction: 5, tension: 100}).start();
    }, [editable]);

    // 处理点击事件（不依赖 value，通过 valueRef 读取最新值，避免每次输入都重建回调）
    const handlePress = React.useCallback(() => {
        if (!editable || !showKeyboard) return;

        if (isProcessingRef.current) return;
        isProcessingRef.current = true;

        const resetTimeout = setTimeout(() => {
            isProcessingRef.current = false;
        }, 1000);

        const currentValue = valueRef.current;

        if (containerRef.current) {
            if (Platform.OS === 'web') {
                const domNode = containerRef.current;
                setTimeout(() => {
                    try {
                        // @ts-ignore
                        const rect = domNode.getBoundingClientRect?.();
                        const pos = rect
                            ? {x: rect.left, y: rect.top, width: rect.width, height: rect.height}
                            : (() => {
                                const defaultY = Dimensions.get('window').height * 0.6;
                                return {x: 0, y: defaultY, width: 300, height: 50};
                            })();
                        showKeyboard(
                            {id: inputIdRef.current, value: currentValue, editingValue: currentValue, position: pos, initialPosition: pos, onChangeText: onChangeTextRef.current, onSubmit: onSubmitRef.current, promptText, maxLength, secureTextEntry},
                            keyboardType
                        );
                    } catch {
                        const defaultY = Dimensions.get('window').height * 0.6;
                        const pos = {x: 0, y: defaultY, width: 300, height: 50};
                        showKeyboard(
                            {id: inputIdRef.current, value: currentValue, editingValue: currentValue, position: pos, initialPosition: pos, onChangeText: onChangeTextRef.current, onSubmit: onSubmitRef.current, promptText, maxLength, secureTextEntry},
                            keyboardType
                        );
                    } finally {
                        clearTimeout(resetTimeout);
                        isProcessingRef.current = false;
                    }
                }, 0);
            } else {
                let measureExecuted = false;
                const fallbackTimeout = setTimeout(() => {
                    if (!measureExecuted) {
                        const defaultY = Dimensions.get('window').height * 0.6;
                        const pos = {x: 0, y: defaultY, width: 300, height: 50};
                        showKeyboard(
                            {id: inputIdRef.current, value: currentValue, editingValue: currentValue, position: pos, initialPosition: pos, onChangeText: onChangeTextRef.current, onSubmit: onSubmitRef.current, promptText, maxLength, secureTextEntry},
                            keyboardType
                        );
                        clearTimeout(resetTimeout);
                        isProcessingRef.current = false;
                    }
                }, 300);

                containerRef.current.measure((x, y, width, height, pageX, pageY) => {
                    measureExecuted = true;
                    clearTimeout(fallbackTimeout);
                    const pos = {x: pageX || 0, y: pageY || 0, width: width || 300, height: height || 50};
                    showKeyboard(
                        {id: inputIdRef.current, value: currentValue, editingValue: currentValue, position: pos, initialPosition: pos, onChangeText: onChangeTextRef.current, onSubmit: onSubmitRef.current, promptText, maxLength, secureTextEntry},
                        keyboardType
                    );
                    clearTimeout(resetTimeout);
                    isProcessingRef.current = false;
                });
            }
        } else {
            clearTimeout(resetTimeout);
            isProcessingRef.current = false;
        }
    }, [editable, keyboardType, showKeyboard, promptText, maxLength, secureTextEntry]);

    // 监听布局变化
    const handleLayout = React.useCallback(() => {
        if (isActive && containerRef.current && Platform.OS !== 'web' && updateInputPosition) {
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
        <View style={[styles.wrapper, style]} ref={containerRef} onLayout={handleLayout}>
            <Pressable
                onPress={editable ? handlePress : undefined}
                onPressIn={editable ? handlePressIn : undefined}
                onPressOut={editable ? handlePressOut : undefined}
                style={styles.pressable}
                hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}
            >
                <Animated.View
                    style={{transform: [{scale: scaleAnim}]}}
                    pointerEvents="none"
                >
                    {displayText ? (
                        <Text style={[styles.text, textStyle]}>{displayText}</Text>
                    ) : (
                        <Text style={[styles.placeholder, {color: placeholderTextColor}]}>{placeholder}</Text>
                    )}
                </Animated.View>
            </Pressable>
        </View>
    );
});

const styles = StyleSheet.create({
    wrapper: {
        flex: 1,
        minHeight: 40,
    },
    pressable: {
        flex: 1,
        justifyContent: 'center',
        minHeight: 40,
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
