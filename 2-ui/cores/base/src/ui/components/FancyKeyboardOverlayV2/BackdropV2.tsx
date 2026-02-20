import React from 'react';
import {Pressable, StyleSheet, View, Dimensions, Animated, Platform} from 'react-native';
import {ActiveInputInfoV2} from '../../../contexts/FancyKeyboardContextV2';

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
export const BackdropV2: React.FC<BackdropV2Props> = ({onPress, activeInput, containerOffset, opacity}) => {
    const screenHeight = Dimensions.get('window').height;
    const screenWidth = Dimensions.get('window').width;
    const [isInteractionEnabled, setIsInteractionEnabled] = React.useState(false);

    // 简化逻辑：延迟启用交互，等待动画完成
    React.useEffect(() => {
        if (activeInput) {
            // 延迟启用交互，等待动画完成（500ms = 动画时长 + 缓冲）
            const timer = setTimeout(() => {
                setIsInteractionEnabled(true);
            }, 500);

            return () => {
                clearTimeout(timer);
                setIsInteractionEnabled(false);
            };
        } else {
            setIsInteractionEnabled(false);
        }
    }, [activeInput]);

    const handlePress = (event: any) => {
        // 在 Web 环境下，阻止事件传播
        if (Platform.OS === 'web' && event) {
            event.stopPropagation();
        }

        if (!isInteractionEnabled) {
            return;
        }

        onPress();
    };

    // 如果没有激活输入框，显示简单的全屏遮罩
    if (!activeInput) {
        // 将 opacity (0-1) 转换为 backgroundColor 的 rgba
        const backgroundColor = opacity.interpolate({
            inputRange: [0, 1],
            outputRange: ['rgba(0, 0, 0, 0)', 'rgba(0, 0, 0, 0.5)'],
        });

        return (
            <View
                style={[
                    styles.backdrop,
                    {
                        pointerEvents: 'box-none',
                    },
                ]}
            >
                <Pressable
                    style={StyleSheet.absoluteFillObject}
                    onPress={handlePress}
                >
                    <Animated.View
                        style={[
                            StyleSheet.absoluteFillObject,
                            {
                                backgroundColor: backgroundColor,
                            }
                        ]}
                    />
                </Pressable>
            </View>
        );
    }

    const {position, initialPosition} = activeInput;
    // 计算输入框移动后的目标位置
    const isFirstRender = position.y === initialPosition.y;

    let targetY: number;
    if (isFirstRender) {
        // 首次渲染，计算目标位置
        targetY = initialPosition.y + containerOffset;
    } else {
        // 已经移动，使用实际位置
        targetY = position.y;
    }

    // 挖空区域：上下与输入框高度一致，左右多出 10px
    const padding = 10;
    const inputTop = targetY; // 上方遮罩到输入框顶部，不加 padding
    const inputBottom = targetY + position.height; // 下方遮罩从输入框底部开始，不加 padding
    const inputLeft = position.x - padding;
    const inputRight = position.x + position.width + padding;

    // 将 opacity (0-1) 转换为 backgroundColor 的 rgba（用于 Web 环境）
    const backgroundColor = opacity.interpolate({
        inputRange: [0, 1],
        outputRange: ['rgba(0, 0, 0, 0)', 'rgba(0, 0, 0, 0.5)'],
    });

    return (
        <View
            style={[
                styles.backdrop,
                {
                    pointerEvents: 'box-none',
                },
            ]}
        >
            <Pressable
                style={StyleSheet.absoluteFillObject}
                onPress={handlePress}
            >
                {/* 使用 4 个 Animated.View 围绕输入框，形成"挖空"效果 */}

                {/* 输入框上方的遮罩 */}
                {inputTop > 0 && (
                    <Animated.View
                        style={[
                            {
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                width: screenWidth,
                                height: inputTop,
                            },
                            Platform.OS === 'web'
                                ? {backgroundColor: backgroundColor}
                                : {backgroundColor: 'rgba(0, 0, 0, 0.5)', opacity: opacity},
                        ]}
                    />
                )}

                {/* 输入框左侧的遮罩 */}
                {inputLeft > 0 && (
                    <Animated.View
                        style={[
                            {
                                position: 'absolute',
                                top: inputTop,
                                left: 0,
                                width: inputLeft,
                                height: position.height, // 与输入框高度一致
                            },
                            Platform.OS === 'web'
                                ? {backgroundColor: backgroundColor}
                                : {backgroundColor: 'rgba(0, 0, 0, 0.5)', opacity: opacity},
                        ]}
                    />
                )}

                {/* 输入框右侧的遮罩 */}
                {inputRight < screenWidth && (
                    <Animated.View
                        style={[
                            {
                                position: 'absolute',
                                top: inputTop,
                                left: inputRight,
                                width: screenWidth - inputRight,
                                height: position.height, // 与输入框高度一致
                            },
                            Platform.OS === 'web'
                                ? {backgroundColor: backgroundColor}
                                : {backgroundColor: 'rgba(0, 0, 0, 0.5)', opacity: opacity},
                        ]}
                    />
                )}

                {/* 输入框下方的遮罩 */}
                {inputBottom < screenHeight && (
                    <Animated.View
                        style={[
                            {
                                position: 'absolute',
                                top: inputBottom,
                                left: 0,
                                width: screenWidth,
                                height: screenHeight - inputBottom,
                            },
                            Platform.OS === 'web'
                                ? {backgroundColor: backgroundColor}
                                : {backgroundColor: 'rgba(0, 0, 0, 0.5)', opacity: opacity},
                        ]}
                    />
                )}
            </Pressable>
        </View>
    );
};

const styles = StyleSheet.create({
    backdrop: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 9998, // 在键盘下方，但在内容上方
    },
    overlay: {
        backgroundColor: 'rgba(0, 0, 0, 0.5)', // 半透明黑色，透明度 0.5
    },
});
