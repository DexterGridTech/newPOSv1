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

    // 监听 opacity 变化，只有当 opacity 接近 1 时才启用交互
    React.useEffect(() => {

        if (!activeInput) {
            setIsInteractionEnabled(false);
            return;
        }

        // 使用 opacity 的监听器来判断动画是否完成
        const listenerId = opacity.addListener(({value}) => {
            // 当透明度大于 0.8 时，认为动画基本完成，可以启用交互
            if (value > 0.8) {
                setIsInteractionEnabled(true);
            } else {
                setIsInteractionEnabled(false);
            }
        });

        return () => {
            opacity.removeListener(listenerId);
        };
    }, [activeInput, opacity]);

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
                                // Web 特定优化
                                ...(Platform.OS === 'web' ? {
                                    willChange: 'background-color',
                                } : {}),
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

    // 挖空区域比输入框大小上下左右都多出 10px
    const padding = 10;
    const inputTop = targetY - padding;
    const inputBottom = targetY + position.height + padding;
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
                                height: position.height + padding * 2,
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
                                height: position.height + padding * 2,
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
