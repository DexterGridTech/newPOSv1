import React from 'react';
import {View, Text, TouchableOpacity, StyleSheet, ViewStyle, TextStyle, Animated} from 'react-native';
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
        if (containerRef.current) {
            containerRef.current.measure((x, y, width, height, pageX, pageY) => {
                showKeyboard(
                    {
                        id: inputIdRef.current,
                        value,
                        editingValue: value, // 初始编辑值为当前值
                        position: {x: pageX, y: pageY, width, height},
                        initialPosition: {x: pageX, y: pageY, width, height},
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
    }, [value, keyboardType, onSubmit, showKeyboard, onChangeText, promptText, maxLength, secureTextEntry]);

    // 监听布局变化
    const handleLayout = React.useCallback(() => {
        if (isActive && containerRef.current) {
            containerRef.current.measure((x, y, width, height, pageX, pageY) => {
                updateInputPosition({x: pageX, y: pageY, width, height});
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
        <TouchableOpacity
            onPress={editable ? handlePress : undefined}
            activeOpacity={1}
            style={[styles.container, style]}
            ref={containerRef}
            onLayout={handleLayout}
        >
            {displayText ? (
                <Text style={[styles.text, textStyle]}>{displayText}</Text>
            ) : (
                <Text style={[styles.placeholder, {color: placeholderTextColor}]}>{placeholder}</Text>
            )}
        </TouchableOpacity>
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
