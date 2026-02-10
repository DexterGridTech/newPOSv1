import React from 'react';
import {TouchableOpacity, StyleSheet, View, Dimensions, Animated} from 'react-native';
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

    if (!activeInput) {
        // 如果没有激活的输入框，显示全屏半透明遮罩（带透明度动画）
        return (
            <Animated.View
                style={[
                    styles.backdrop,
                    {
                        opacity: opacity,
                    },
                ]}
                pointerEvents="box-none"
            >
                <TouchableOpacity
                    style={StyleSheet.absoluteFillObject}
                    activeOpacity={1}
                    onPress={onPress}
                >
                    <View style={styles.overlay} />
                </TouchableOpacity>
            </Animated.View>
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

    return (
        <Animated.View
            style={[
                styles.backdrop,
                {
                    opacity: opacity,
                },
            ]}
            pointerEvents="box-none"
        >
            <TouchableOpacity
                style={StyleSheet.absoluteFillObject}
                activeOpacity={1}
                onPress={onPress}
            >
                {/* 使用 4 个 View 围绕输入框，形成"挖空"效果 */}

                {/* 输入框上方的遮罩 */}
                {inputTop > 0 && (
                    <View
                        style={[
                            styles.overlay,
                            {
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                width: screenWidth,
                                height: inputTop,
                            },
                        ]}
                    />
                )}

                {/* 输入框左侧的遮罩 */}
                {inputLeft > 0 && (
                    <View
                        style={[
                            styles.overlay,
                            {
                                position: 'absolute',
                                top: inputTop,
                                left: 0,
                                width: inputLeft,
                                height: position.height + padding * 2,
                            },
                        ]}
                    />
                )}

                {/* 输入框右侧的遮罩 */}
                {inputRight < screenWidth && (
                    <View
                        style={[
                            styles.overlay,
                            {
                                position: 'absolute',
                                top: inputTop,
                                left: inputRight,
                                width: screenWidth - inputRight,
                                height: position.height + padding * 2,
                            },
                        ]}
                    />
                )}

                {/* 输入框下方的遮罩 */}
                {inputBottom < screenHeight && (
                    <View
                        style={[
                            styles.overlay,
                            {
                                position: 'absolute',
                                top: inputBottom,
                                left: 0,
                                width: screenWidth,
                                height: screenHeight - inputBottom,
                            },
                        ]}
                    />
                )}
            </TouchableOpacity>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    backdrop: {
        ...StyleSheet.absoluteFillObject,
    },
    overlay: {
        backgroundColor: 'rgba(0, 0, 0, 0.5)', // 半透明黑色，透明度 0.5
    },
});
