import React, {memo, useCallback, useState} from 'react';
import {Platform, Pressable, StyleProp, Text, TextStyle, View, ViewStyle} from 'react-native';

interface ResponderKeyButtonProps {
    label: string;
    onPress: () => void;
    style?: StyleProp<ViewStyle>;
    textStyle?: StyleProp<TextStyle>;
    pressedStyle?: StyleProp<ViewStyle>;
    disabled?: boolean;
}

/**
 * 统一的键盘按键组件。
 *
 * 目标：
 * 1. 保留统一入口，对外不暴露平台差异；
 * 2. Web 走 Pressable onPress，优先保证浏览器环境兼容性；
 * 3. Native 走 responder，在按下时立即触发；
 * 4. 保持轻量，不引入额外手势库。
 */
export const ResponderKeyButton = memo<ResponderKeyButtonProps>(({label, onPress, style, textStyle, pressedStyle, disabled = false}) => {
    const [pressed, setPressed] = useState(false);

    const handleWebPress = useCallback(() => {
        if (disabled) {
            return;
        }
        onPress();
    }, [disabled, onPress]);

    const handleWebPressIn = useCallback(() => {
        if (disabled) {
            return;
        }
        setPressed(true);
    }, [disabled]);

    const handleWebPressOut = useCallback(() => {
        setPressed(false);
    }, []);

    const handleGrant = useCallback(() => {
        if (disabled) {
            return;
        }
        setPressed(true);
        onPress();
    }, [disabled, onPress]);

    const handleRelease = useCallback(() => {
        setPressed(false);
    }, []);

    const handleTerminate = useCallback(() => {
        setPressed(false);
    }, []);

    if (Platform.OS === 'web') {
        return (
            <Pressable
                disabled={disabled}
                onPress={handleWebPress}
                onPressIn={handleWebPressIn}
                onPressOut={handleWebPressOut}
                style={({pressed: isPressed}) => [style, pressed || isPressed ? pressedStyle : null]}
            >
                <Text style={textStyle}>{label}</Text>
            </Pressable>
        );
    }

    return (
        <View
            onStartShouldSetResponder={() => !disabled}
            onMoveShouldSetResponder={() => false}
            onResponderGrant={handleGrant}
            onResponderRelease={handleRelease}
            onResponderTerminate={handleTerminate}
            onResponderTerminationRequest={() => true}
            style={[style, pressed ? pressedStyle : null]}
        >
            <Text style={textStyle}>{label}</Text>
        </View>
    );
});
