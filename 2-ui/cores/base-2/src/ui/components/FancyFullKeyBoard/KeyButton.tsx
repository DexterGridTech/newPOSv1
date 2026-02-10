import React, {useState} from 'react';
import {TouchableOpacity, Text, StyleSheet} from 'react-native';
import {KeyConfig} from './keyLayouts';

interface KeyButtonProps {
    keyConfig: KeyConfig;
    onPress: (value: string) => void;
    isFullHeight?: boolean;
}

/**
 * 键盘按键组件 - 高性能版本
 */
export const KeyButton: React.FC<KeyButtonProps> = React.memo(({keyConfig, onPress, isFullHeight}) => {
    const [isPressed, setIsPressed] = useState(false);

    const handlePressIn = () => {
        setIsPressed(true);
    };

    const handlePressOut = () => {
        setIsPressed(false);
    };

    const handlePress = () => {
        onPress(keyConfig.value);
    };

    const getButtonStyle = () => {
        if (keyConfig.value === 'CONFIRM') {
            return isPressed ? styles.confirmKeyPressed : styles.confirmKey;
        }
        if (keyConfig.value === 'DELETE') {
            return isPressed ? styles.deleteKeyPressed : styles.deleteKey;
        }
        switch (keyConfig.type) {
            case 'function':
                return isPressed ? styles.functionKeyPressed : styles.functionKey;
            case 'symbol':
                return isPressed ? styles.symbolKeyPressed : styles.symbolKey;
            default:
                return isPressed ? styles.normalKeyPressed : styles.normalKey;
        }
    };

    const getTextStyle = () => {
        if (keyConfig.type === 'function' || keyConfig.value === 'DELETE' || keyConfig.value === 'CONFIRM') {
            return [styles.keyText, styles.functionKeyText, keyConfig.value === 'CONFIRM' && styles.confirmKeyText];
        }
        return styles.keyText;
    };

    return (
        <TouchableOpacity
            style={[styles.keyContainer, {flex: keyConfig.flex || 1}, isFullHeight && styles.fullHeightContainer]}
            onPress={handlePress}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            activeOpacity={1}
        >
            <Text style={[styles.keyButton, getButtonStyle(), getTextStyle(), isFullHeight && styles.fullHeightButton]} numberOfLines={1}>
                {keyConfig.label}
            </Text>
        </TouchableOpacity>
    );
});

const styles = StyleSheet.create({
    keyContainer: {
        padding: 2,
    },
    fullHeightContainer: {
        padding: 2,
    },
    keyButton: {
        flex: 1,
        textAlign: 'center',
        textAlignVertical: 'center',
        borderRadius: 8,
        paddingVertical: 12,
        paddingHorizontal: 4,
        fontSize: 18,
        fontWeight: '600',
        includeFontPadding: false,
    },
    fullHeightButton: {
        paddingVertical: 0,
    },
    normalKey: {
        backgroundColor: '#FFFFFF',
        color: '#1F2937',
    },
    normalKeyPressed: {
        backgroundColor: '#E5E7EB',
        color: '#1F2937',
    },
    functionKey: {
        backgroundColor: '#3B82F6',
    },
    functionKeyPressed: {
        backgroundColor: '#2563EB',
    },
    deleteKey: {
        backgroundColor: '#EF4444',
    },
    deleteKeyPressed: {
        backgroundColor: '#DC2626',
    },
    confirmKey: {
        backgroundColor: '#10B981',
    },
    confirmKeyPressed: {
        backgroundColor: '#059669',
    },
    symbolKey: {
        backgroundColor: '#E5E7EB',
        color: '#1F2937',
    },
    symbolKeyPressed: {
        backgroundColor: '#D1D5DB',
        color: '#1F2937',
    },
    keyText: {},
    functionKeyText: {
        color: '#FFFFFF',
    },
    confirmKeyText: {
        fontSize: 24,
    },
});
