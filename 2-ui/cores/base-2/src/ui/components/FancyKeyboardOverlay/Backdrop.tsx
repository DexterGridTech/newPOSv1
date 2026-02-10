import React, {useRef, useEffect} from 'react';
import {TouchableOpacity, StyleSheet, View, Dimensions, Animated} from 'react-native';
import {ActiveInputInfo} from '../../../contexts/FancyKeyboardContext';

interface BackdropProps {
    onPress: () => void;
    activeInput: ActiveInputInfo | null;
    containerOffset: number;
}

/**
 * 半透明遮罩组件，模拟 MaskedView 效果
 * 通过多层 View 叠加实现：输入框区域全透明，其他区域半透明
 * 遮罩会随着 container 一起移动（使用 transform）
 * 遮罩的透明度有渐变动画
 */
export const Backdrop: React.FC<BackdropProps> = ({onPress, activeInput, containerOffset}) => {
    const screenHeight = Dimensions.get('window').height;
    const screenWidth = Dimensions.get('window').width;

    // 透明度动画值
    const opacityAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (activeInput) {
            // 有输入框激活时，渐变显示遮罩
            Animated.timing(opacityAnim, {
                toValue: 1,
                duration: 200,
                useNativeDriver: true,
            }).start();
        } else {
            // 没有输入框激活时，渐变隐藏遮罩
            Animated.timing(opacityAnim, {
                toValue: 0,
                duration: 200,
                useNativeDriver: true,
            }).start();
        }
    }, [activeInput, opacityAnim]);

    if (!activeInput) {
        // 如果没有激活的输入框，显示全屏半透明遮罩（带透明度动画）
        return (
            <Animated.View
                style={[
                    styles.backdrop,
                    {
                        opacity: opacityAnim,
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
    // 如果 position 和 initialPosition 相同，说明是首次显示，需要计算目标位置
    // 如果不同，说明已经移动了，直接使用 position
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
                    // Backdrop 不移动，固定在屏幕上
                    // 只有挖空位置跟随输入框的实际屏幕位置
                    // transform: [{translateY: containerOffset}], // 移除这行
                    // 透明度渐变动画
                    opacity: opacityAnim,
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
        backgroundColor: 'rgba(0, 0, 0, 0.3)', // 半透明黑色，透明度 0.3
    },
});
