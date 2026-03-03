import React, {memo, useCallback, useRef} from 'react';
import {Pressable, StyleSheet, View, Dimensions, Animated, Platform} from 'react-native';
import {ActiveInputInfoV2} from '../../../contexts/FancyKeyboardContextV2';

const {height: screenHeight, width: screenWidth} = Dimensions.get('window');

interface BackdropV2Props {
    onPress: () => void;
    activeInput: ActiveInputInfoV2 | null;
    containerOffset: number;
    opacity: Animated.Value;
}

/**
 * 半透明遮罩组件 V2
 * 通过多层 View 叠加实现：输入框区域全透明，其他区域半透明
 */
export const BackdropV2: React.FC<BackdropV2Props> = memo(({onPress, activeInput, containerOffset, opacity}) => {
    // 用 ref 替代 state，避免 500ms 后 setIsInteractionEnabled(true) 触发 Pressable 重渲染
    const isInteractionEnabledRef = useRef(false);

    React.useEffect(() => {
        if (activeInput) {
            const timer = setTimeout(() => { isInteractionEnabledRef.current = true; }, 500);
            return () => {
                clearTimeout(timer);
                isInteractionEnabledRef.current = false;
            };
        } else {
            isInteractionEnabledRef.current = false;
        }
    }, [activeInput]);

    // handlePress 不依赖任何 state，永远稳定，Pressable 不会因此重渲染
    const handlePress = useCallback((event: any) => {
        if (Platform.OS === 'web' && event) event.stopPropagation();
        if (!isInteractionEnabledRef.current) return;
        onPress();
    }, [onPress]);

    // 将 opacity (0-1) 转换为 backgroundColor 的 rgba（Web 环境）
    const backgroundColor = opacity.interpolate({
        inputRange: [0, 1],
        outputRange: ['rgba(0, 0, 0, 0)', 'rgba(0, 0, 0, 0.5)'],
    });

    // 如果没有激活输入框，显示简单的全屏遮罩
    if (!activeInput) {
        return (
            <View style={[styles.backdrop, {pointerEvents: 'box-none'}]}>
                <Pressable style={StyleSheet.absoluteFillObject} onPress={handlePress}>
                    <Animated.View
                        style={[
                            StyleSheet.absoluteFillObject,
                            Platform.OS === 'web'
                                ? {backgroundColor}
                                : {backgroundColor: 'rgba(0, 0, 0, 0.5)', opacity},
                        ]}
                    />
                </Pressable>
            </View>
        );
    }

    const {position, initialPosition} = activeInput;
    // 用 initialPosition + containerOffset 计算目标位置，避免依赖 position.y 是否已更新的不确定性
    const targetY = initialPosition.y + containerOffset;

    const padding = 10;
    const inputTop = targetY;
    const inputBottom = targetY + position.height;
    const inputLeft = position.x - padding;
    const inputRight = position.x + position.width + padding;

    const overlayStyle = Platform.OS === 'web'
        ? {backgroundColor}
        : {backgroundColor: 'rgba(0, 0, 0, 0.5)', opacity};

    return (
        <View style={[styles.backdrop, {pointerEvents: 'box-none'}]}>
            <Pressable style={StyleSheet.absoluteFillObject} onPress={handlePress}>
                {/* 输入框上方 */}
                {inputTop > 0 && (
                    <Animated.View style={[{position: 'absolute', top: 0, left: 0, width: screenWidth, height: inputTop}, overlayStyle]}/>
                )}
                {/* 输入框左侧 */}
                {inputLeft > 0 && (
                    <Animated.View style={[{position: 'absolute', top: inputTop, left: 0, width: inputLeft, height: position.height}, overlayStyle]}/>
                )}
                {/* 输入框右侧 */}
                {inputRight < screenWidth && (
                    <Animated.View style={[{position: 'absolute', top: inputTop, left: inputRight, width: screenWidth - inputRight, height: position.height}, overlayStyle]}/>
                )}
                {/* 输入框下方 */}
                {inputBottom < screenHeight && (
                    <Animated.View style={[{position: 'absolute', top: inputBottom, left: 0, width: screenWidth, height: screenHeight - inputBottom}, overlayStyle]}/>
                )}
            </Pressable>
        </View>
    );
});

const styles = StyleSheet.create({
    backdrop: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 9998,
    },
});
