import React, {useRef, useEffect, useContext, useCallback, memo} from 'react';
import {View, StyleSheet, Dimensions, Animated, Platform} from 'react-native';
import {
    FancyKeyboardDisplayContextV2,
    FancyKeyboardActionsContextV2,
    FancyKeyboardEditingContextV2,
    FancyKeyboardActionsV2,
} from '../../../contexts/FancyKeyboardContextV2';
import {FancyFullKeyBoardV2} from '../FancyFullKeyBoardV2';
import {FancyNumberKeyBoardV2} from '../FancyNumberKeyBoardV2';
import {BackdropV2} from './BackdropV2';
import {EditingContent} from './EditingContent';

const {height: screenHeight} = Dimensions.get('window');
const KEYBOARD_HEIGHT = (screenHeight * 2) / 5;
const TOTAL_HEIGHT = KEYBOARD_HEIGHT + 80;

// ─── KeyboardArea ─────────────────────────────────────────────────────────────
// 订阅 editing context，将 hasChanges 的重渲染隔离在此组件内
// Overlay 主体不再因每次按键而重渲染
const KeyboardArea = memo<{
    keyboardType: 'full' | 'number';
    shouldShakeConfirmButton: boolean;
    actions: FancyKeyboardActionsV2;
    onShakeEditingContent: () => void;
    hasChangesRef: React.MutableRefObject<boolean>;
}>(({keyboardType, shouldShakeConfirmButton, actions, onShakeEditingContent, hasChangesRef}) => {
    const editing = useContext(FancyKeyboardEditingContextV2);

    // 用 ref 持有最新 editing，handleKeyPress 不因 editingValue 变化重建
    const editingRef = useRef(editing);
    editingRef.current = editing;

    // 同步 hasChanges 到外部 ref，供 backdrop 使用
    hasChangesRef.current = editing?.hasChanges ?? false;

    const handleKeyPress = useCallback((key: string) => {
        const cur = editingRef.current;
        const editingValue = cur?.editingValue ?? '';
        const maxLength = cur?.maxLength;

        if (key === 'DELETE' || key === 'backspace') {
            if (editingValue.length > 0) actions.updateEditingValue(editingValue.slice(0, -1));
        } else if (key === 'CONFIRM' || key === 'enter') {
            actions.confirmInput();
        } else {
            if (maxLength !== undefined && editingValue.length >= maxLength) {
                onShakeEditingContent();
                return;
            }
            actions.updateEditingValue(editingValue + key);
        }
    }, [actions, onShakeEditingContent]);

    const hasChanges = editing?.hasChanges ?? false;

    return (
        <View style={{flex: 1, backgroundColor: '#F1F5F9'}}>
            {keyboardType === 'full' ? (
                <FancyFullKeyBoardV2
                    onKeyPress={handleKeyPress}
                    onCancel={actions.cancelInput}
                    onConfirm={actions.confirmInput}
                    shouldShake={shouldShakeConfirmButton}
                    hasChanges={hasChanges}
                />
            ) : (
                <FancyNumberKeyBoardV2
                    onKeyPress={handleKeyPress}
                    onCancel={actions.cancelInput}
                    onConfirm={actions.confirmInput}
                    shouldShake={shouldShakeConfirmButton}
                    hasChanges={hasChanges}
                />
            )}
        </View>
    );
});

// ─── FancyKeyboardOverlayV2 ───────────────────────────────────────────────────
// 只订阅 display context，不订阅 editing context
// 每次按键不会触发此组件重渲染
export const FancyKeyboardOverlayV2: React.FC = () => {
    const display = useContext(FancyKeyboardDisplayContextV2);
    const actions = useContext(FancyKeyboardActionsContextV2);

    const isVisible = display?.isVisible ?? false;
    const keyboardType = display?.keyboardType ?? 'full';
    const activeInput = display?.activeInput ?? null;
    const containerOffset = display?.containerOffset ?? 0;
    const shouldShakeConfirmButton = display?.shouldShakeConfirmButton ?? false;

    const keyboardTranslateY = useRef(new Animated.Value(screenHeight)).current;
    const backdropOpacity = useRef(new Animated.Value(0)).current;
    const [shouldShakeEditingContent, setShouldShakeEditingContent] = React.useState(false);
    const shakeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // hasChanges 由 KeyboardArea 同步写入，backdrop 按需读取
    const hasChangesRef = useRef(false);

    const backdropTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        if (isVisible) {
            if (Platform.OS === 'web') {
                Animated.timing(keyboardTranslateY, {toValue: 0, duration: 300, useNativeDriver: false}).start(() => {
                    Animated.timing(backdropOpacity, {toValue: 1, duration: 200, useNativeDriver: false}).start();
                });
            } else {
                Animated.spring(keyboardTranslateY, {toValue: 0, useNativeDriver: true, tension: 50, friction: 8}).start();
                backdropTimerRef.current = setTimeout(() => {
                    Animated.timing(backdropOpacity, {toValue: 1, duration: 200, useNativeDriver: true}).start();
                }, 350);
            }
        } else {
            if (backdropTimerRef.current) clearTimeout(backdropTimerRef.current);
            Animated.timing(backdropOpacity, {toValue: 0, duration: 0, useNativeDriver: Platform.OS !== 'web'}).start(() => {
                Animated.timing(keyboardTranslateY, {toValue: screenHeight, duration: 200, useNativeDriver: Platform.OS !== 'web'}).start();
            });
        }
        return () => { if (backdropTimerRef.current) clearTimeout(backdropTimerRef.current); };
    }, [isVisible]);

    // 清理 shake timer
    useEffect(() => () => { if (shakeTimerRef.current) clearTimeout(shakeTimerRef.current); }, []);

    const handleShakeEditingContent = useCallback(() => {
        setShouldShakeEditingContent(true);
        if (shakeTimerRef.current) clearTimeout(shakeTimerRef.current);
        shakeTimerRef.current = setTimeout(() => setShouldShakeEditingContent(false), 200);
    }, []);

    const handleBackdropPress = useCallback(() => {
        if (!actions) return;
        if (hasChangesRef.current) {
            actions.shakeConfirmButton();
        } else {
            actions.cancelInput();
        }
    }, [actions]);

    if (!actions) return null;

    return (
        <View style={[styles.overlay, {pointerEvents: isVisible ? 'auto' : 'none'}]}>
            <BackdropV2
                onPress={handleBackdropPress}
                activeInput={activeInput}
                containerOffset={containerOffset}
                opacity={backdropOpacity}
            />
            <Animated.View
                style={[
                    styles.keyboardContainer,
                    {height: TOTAL_HEIGHT},
                    Platform.OS === 'web'
                        ? {bottom: keyboardTranslateY.interpolate({inputRange: [0, screenHeight], outputRange: [0, -screenHeight]})}
                        : {transform: [{translateY: keyboardTranslateY}]},
                ]}
            >
                <EditingContent shouldShake={shouldShakeEditingContent} isVisible={isVisible}/>
                <KeyboardArea
                    keyboardType={keyboardType}
                    shouldShakeConfirmButton={shouldShakeConfirmButton}
                    actions={actions}
                    onShakeEditingContent={handleShakeEditingContent}
                    hasChangesRef={hasChangesRef}
                />
            </Animated.View>
        </View>
    );
};

const styles = StyleSheet.create({
    overlay: {...StyleSheet.absoluteFillObject, zIndex: 9999},
    keyboardContainer: {
        position: 'absolute', bottom: 0, left: 0, right: 0,
        backgroundColor: '#FFFFFF',
        shadowColor: '#000', shadowOffset: {width: 0, height: -2},
        shadowOpacity: 0.1, shadowRadius: 8, elevation: 10, zIndex: 10000,
    },
});
