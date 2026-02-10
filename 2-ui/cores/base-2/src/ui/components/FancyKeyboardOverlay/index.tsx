import React, {useEffect, useRef} from 'react';
import {View, Animated, Dimensions} from 'react-native';
import {useFancyKeyboard} from '../../../hooks/useFancyKeyboard';
import {useKeyboardAnimation} from '../../../hooks/useKeyboardAnimation';
import {Backdrop} from './Backdrop';
import {InputMask} from './InputMask';
import {FancyFullKeyBoard, FancyFullKeyBoardRef} from '../FancyFullKeyBoard';
import {FancyNumberKeyBoard, FancyNumberKeyBoardRef} from '../FancyNumberKeyBoard';
import {styles} from './styles';

/**
 * 键盘遮罩层组件
 */
export const FancyKeyboardOverlay: React.FC = React.memo(() => {
    const {
        isVisible,
        keyboardType,
        activeInput,
        hideKeyboard,
        updateInputValue,
        containerOffset,
    } = useFancyKeyboard();

    const {animatedValue, show, hide} = useKeyboardAnimation(150);
    const fullKeyboardRef = useRef<FancyFullKeyBoardRef>(null);
    const numberKeyboardRef = useRef<FancyNumberKeyBoardRef>(null);

    const screenHeight = Dimensions.get('window').height;
    // 键盘高度固定为屏幕高度的 2/5
    const keyboardHeight = (screenHeight * 2) / 5;

    useEffect(() => {
        if (isVisible) {
            show();
        } else {
            hide();
        }
    }, [isVisible, show, hide]);

    const handleBackdropPress = () => {
        // 点击遮罩时，触发确认按钮抖动动画
        if (keyboardType === 'full') {
            fullKeyboardRef.current?.shakeConfirmButton();
        } else {
            numberKeyboardRef.current?.shakeConfirmButton();
        }
    };

    const handleKeyPress = (key: string) => {
        if (!activeInput) return;

        if (key === 'CONFIRM') {
            // 点击确认按钮，关闭键盘
            hideKeyboard();
        } else if (key === 'DELETE') {
            const newValue = activeInput.value.slice(0, -1);
            updateInputValue(newValue);
        } else {
            const newValue = activeInput.value + key;
            updateInputValue(newValue);
        }
    };

    // 键盘组件始终渲染，只控制显示/隐藏
    const translateY = animatedValue.interpolate({
        inputRange: [0, 1],
        outputRange: [keyboardHeight, 0],
    });

    return (
        <View style={styles.container} pointerEvents={isVisible ? "auto" : "none"}>
            {/* 遮罩点击时触发确认按钮动画，传递 activeInput 和 containerOffset */}
            <Backdrop onPress={handleBackdropPress} activeInput={activeInput} containerOffset={containerOffset} />
            <Animated.View
                style={[
                    styles.keyboardContainer,
                    {
                        height: keyboardHeight,
                        transform: [{translateY}],
                        backgroundColor: '#F5F5F5',
                    },
                ]}
            >
                {/* 两个键盘都渲染，通过 display 控制显示，避免切换时重新初始化 */}
                <View style={{display: keyboardType === 'full' ? 'flex' : 'none', flex: 1, opacity: isVisible ? 1 : 0}}>
                    <FancyFullKeyBoard ref={fullKeyboardRef} onKeyPress={handleKeyPress} />
                </View>
                <View style={{display: keyboardType === 'number' ? 'flex' : 'none', flex: 1, opacity: isVisible ? 1 : 0}}>
                    <FancyNumberKeyBoard ref={numberKeyboardRef} onKeyPress={handleKeyPress} />
                </View>
            </Animated.View>
        </View>
    );
});
