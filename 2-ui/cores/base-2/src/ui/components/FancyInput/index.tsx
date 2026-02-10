import React from 'react';
import {View, Text, TouchableOpacity, StyleSheet, ViewStyle, TextStyle} from 'react-native';
import {useFancyKeyboard} from '../../../hooks/useFancyKeyboard';

/**
 * FancyInput Props
 */
export interface FancyInputProps {
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
}

/**
 * FancyInput 组件
 * 使用 View + Text 模拟输入框，配合自定义软键盘
 */
export const FancyInput: React.FC<FancyInputProps> = ({
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
}) => {
    const containerRef = React.useRef<View>(null);
    const inputIdRef = React.useRef<string>(Math.random().toString(36).substr(2, 9));
    const {showKeyboard, activeInput, updateInputPosition} = useFancyKeyboard();

    // 判断当前输入框是否激活
    const isActive = activeInput?.id === inputIdRef.current;

    // 处理点击事件
    const handlePress = React.useCallback(() => {
        if (containerRef.current) {
            // 使用 measure 获取位置
            containerRef.current.measure((x, y, width, height, pageX, pageY) => {
                showKeyboard(
                    {
                        id: inputIdRef.current,
                        value,
                        position: {x: pageX, y: pageY, width, height},
                        initialPosition: {x: pageX, y: pageY, width, height}, // 保存初始位置
                        onChangeText,
                        onSubmit,
                    },
                    keyboardType
                );
            });
        }
    }, [value, keyboardType, onSubmit, showKeyboard, onChangeText]);

    // 监听布局变化，当输入框激活时实时更新位置
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
