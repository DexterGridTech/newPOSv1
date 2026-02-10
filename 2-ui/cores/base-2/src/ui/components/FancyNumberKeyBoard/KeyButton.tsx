import React, {useState} from 'react';
import {TouchableOpacity, Text, StyleSheet} from 'react-native';

interface KeyButtonProps {
    label: string;
    value: string;
    onPress: (value: string) => void;
    isFunction?: boolean;
    isConfirm?: boolean;
    isFullHeight?: boolean;
    flex?: number;
}

/**
 * 数字键盘按键组件 - 高性能版本
 */
export const KeyButton: React.FC<KeyButtonProps> = React.memo(({label, value, onPress, isFunction, isConfirm, isFullHeight, flex}) => {
    const [isPressed, setIsPressed] = useState(false);

    const handlePressIn = () => {
        setIsPressed(true);
    };

    const handlePressOut = () => {
        setIsPressed(false);
    };

    const handlePress = () => {
        onPress(value);
    };

    const getButtonStyle = () => {
        if (isConfirm) {
            return isPressed ? styles.confirmKeyPressed : styles.confirmKey;
        }
        if (isFunction) {
            return isPressed ? styles.functionKeyPressed : styles.functionKey;
        }
        return isPressed ? styles.normalKeyPressed : styles.normalKey;
    };

    return (
        <TouchableOpacity
            style={[styles.keyContainer, isFullHeight && styles.fullHeightContainer, flex !== undefined && {flex}]}
            onPress={handlePress}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            activeOpacity={1}
        >
            <Text style={[styles.keyButton, getButtonStyle(), (isFunction || isConfirm) && styles.functionKeyText, isFullHeight && styles.fullHeightButton]} numberOfLines={1}>
                {label}
            </Text>
        </TouchableOpacity>
    );
});

const styles = StyleSheet.create({
    keyContainer: {
        flex: 1,
        padding: 4,
    },
    fullHeightContainer: {
        padding: 4,
    },
    keyButton: {
        flex: 1,
        textAlign: 'center',
        textAlignVertical: 'center',
        borderRadius: 12,
        fontSize: 24,
        fontWeight: '600',
        color: '#1F2937',
        includeFontPadding: false,
    },
    fullHeightButton: {
    },
    normalKey: {
        backgroundColor: '#FFFFFF',
    },
    normalKeyPressed: {
        backgroundColor: '#E5E7EB',
    },
    functionKey: {
        backgroundColor: '#EF4444',
    },
    functionKeyPressed: {
        backgroundColor: '#DC2626',
    },
    confirmKey: {
        backgroundColor: '#10B981',
    },
    confirmKeyPressed: {
        backgroundColor: '#059669',
    },
    functionKeyText: {
        color: '#FFFFFF',
    },
});
