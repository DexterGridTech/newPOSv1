import React, {useRef, useEffect} from 'react';
import {View, StyleSheet, Dimensions, Animated, TouchableOpacity, Text} from 'react-native';
import {useFancyKeyboardV2} from '../../../hooks/useFancyKeyboardV2';
import {FancyFullKeyBoardV2} from '../FancyFullKeyBoardV2';
import {FancyNumberKeyBoardV2} from '../FancyNumberKeyBoardV2';
import {BackdropV2} from './BackdropV2';
import {EditingContent} from './EditingContent';

const {height: screenHeight} = Dimensions.get('window');

/**
 * FancyKeyboardOverlayV2 组件
 * 包含 EditingContent、键盘、确定/取消按钮
 */
export const FancyKeyboardOverlayV2: React.FC = () => {
    const {
        isVisible,
        keyboardType,
        activeInput,
        containerOffset,
        updateEditingValue,
        confirmInput,
        cancelInput,
        shakeConfirmButton,
        shouldShakeConfirmButton,
    } = useFancyKeyboardV2();

    // 键盘动画
    const keyboardTranslateY = useRef(new Animated.Value(screenHeight)).current;
    // 遮罩透明度动画
    const backdropOpacity = useRef(new Animated.Value(0)).current;
    // EditingContent 抖动状态
    const [shouldShakeEditingContent, setShouldShakeEditingContent] = React.useState(false);

    useEffect(() => {
        if (isVisible) {
            // 键盘位移和遮罩渐变同时开始，但遮罩延迟到键盘位移完成后才开始
            const keyboardAnimation = Animated.spring(keyboardTranslateY, {
                toValue: 0,
                useNativeDriver: true,
                tension: 50,
                friction: 8,
            });

            // 计算键盘动画大约需要的时间（spring动画大约300-400ms）
            keyboardAnimation.start();

            // 延迟启动遮罩动画，等待键盘位移完成
            setTimeout(() => {
                Animated.timing(backdropOpacity, {
                    toValue: 1,
                    duration: 200,
                    useNativeDriver: true,
                }).start();
            }, 350); // spring动画大约350ms完成
        } else {
            // 隐藏时，遮罩立刻消失，然后键盘下滑
            Animated.timing(backdropOpacity, {
                toValue: 0,
                duration: 0,
                useNativeDriver: true,
            }).start(() => {
                // 遮罩消失后，键盘下滑
                Animated.timing(keyboardTranslateY, {
                    toValue: screenHeight,
                    duration: 200,
                    useNativeDriver: true,
                }).start();
            });
        }
    }, [isVisible, keyboardTranslateY, backdropOpacity]);

    // 处理按键
    const handleKeyPress = (key: string) => {
        if (!activeInput) return;

        const {editingValue, maxLength} = activeInput;

        if (key === 'DELETE' || key === 'backspace') {
            // 删除键
            if (editingValue.length > 0) {
                updateEditingValue(editingValue.slice(0, -1));
            }
        } else if (key === 'CONFIRM' || key === 'enter') {
            // 确认键（键盘内部的确认按钮或上方的确定按钮）
            confirmInput();
        } else {
            // 普通字符输入
            // 检查最大长度
            if (maxLength && editingValue.length >= maxLength) {
                // 触发 EditingContent 抖动
                setShouldShakeEditingContent(true);
                setTimeout(() => setShouldShakeEditingContent(false), 200);
                return;
            }
            updateEditingValue(editingValue + key);
        }
    };

    const keyboardHeight = (screenHeight * 2) / 5;
    const editingContentHeight = 80;
    const totalHeight = keyboardHeight + editingContentHeight;

    // 判断是否有变化
    const hasChanges = activeInput ? activeInput.value !== activeInput.editingValue : false;

    // 处理遮罩点击
    const handleBackdropPress = () => {
        if (hasChanges) {
            // 有变化：抖动确定按钮提示用户
            shakeConfirmButton();
        } else {
            // 无变化：直接关闭键盘
            cancelInput();
        }
    };

    return (
        <View style={styles.overlay} pointerEvents={isVisible ? 'auto' : 'none'}>
            {/* 遮罩 */}
            <BackdropV2
                onPress={handleBackdropPress}
                activeInput={activeInput}
                containerOffset={containerOffset}
                opacity={backdropOpacity}
            />

            {/* 键盘容器 */}
            <Animated.View
                style={[
                    styles.keyboardContainer,
                    {
                        height: totalHeight,
                        transform: [{translateY: keyboardTranslateY}],
                    },
                ]}
            >
                {/* EditingContent 区域 */}
                <EditingContent activeInput={activeInput} shouldShake={shouldShakeEditingContent} />

                {/* 键盘区域 */}
                <View style={[styles.keyboardArea, {height: keyboardHeight}]}>
                    {/* 两个键盘都渲染，通过 display 控制显示，避免切换时重新初始化 */}
                    <View style={{display: keyboardType === 'full' ? 'flex' : 'none', flex: 1, opacity: isVisible ? 1 : 0}}>
                        <FancyFullKeyBoardV2
                            onKeyPress={handleKeyPress}
                            onCancel={cancelInput}
                            onConfirm={confirmInput}
                            shouldShake={shouldShakeConfirmButton}
                            hasChanges={hasChanges}
                        />
                    </View>
                    <View style={{display: keyboardType === 'number' ? 'flex' : 'none', flex: 1, opacity: isVisible ? 1 : 0}}>
                        <FancyNumberKeyBoardV2
                            onKeyPress={handleKeyPress}
                            onCancel={cancelInput}
                            onConfirm={confirmInput}
                            shouldShake={shouldShakeConfirmButton}
                            hasChanges={hasChanges}
                        />
                    </View>
                </View>
            </Animated.View>
        </View>
    );
};

const styles = StyleSheet.create({
    overlay: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 9999,
    },
    keyboardContainer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: '#FFFFFF',
        shadowColor: '#000',
        shadowOffset: {width: 0, height: -2},
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 10,
    },
    keyboardArea: {
        backgroundColor: '#E5E7EB',
    },
});
