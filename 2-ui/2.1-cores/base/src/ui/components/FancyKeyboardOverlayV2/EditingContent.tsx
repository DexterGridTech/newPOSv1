import React, {useRef, useEffect, useContext, memo} from 'react';
import {View, Text, StyleSheet, Animated} from 'react-native';
import {FancyKeyboardEditingContextV2} from '../../../contexts/FancyKeyboardContextV2';

interface EditingContentProps {
    shouldShake: boolean;
    isVisible: boolean;
}

/**
 * EditingContent 只订阅 FancyKeyboardEditingContextV2
 * 每次按键只有此组件重渲染，键盘按键区域不受影响
 */
export const EditingContent: React.FC<EditingContentProps> = memo(({shouldShake, isVisible}) => {
    const editing = useContext(FancyKeyboardEditingContextV2);
    const cursorOpacity = useRef(new Animated.Value(1)).current;
    const shakeAnim = useRef(new Animated.Value(0)).current;
    const blinkRef = useRef<Animated.CompositeAnimation | null>(null);

    useEffect(() => {
        if (isVisible) {
            blinkRef.current = Animated.loop(
                Animated.sequence([
                    Animated.timing(cursorOpacity, {toValue: 0, duration: 500, useNativeDriver: true}),
                    Animated.timing(cursorOpacity, {toValue: 1, duration: 500, useNativeDriver: true}),
                ])
            );
            blinkRef.current.start();
        } else {
            blinkRef.current?.stop();
            cursorOpacity.setValue(1);
        }
        return () => { blinkRef.current?.stop(); };
    }, [isVisible]);

    useEffect(() => {
        if (!shouldShake) return;
        Animated.sequence([
            Animated.timing(shakeAnim, {toValue: 10, duration: 50, useNativeDriver: true}),
            Animated.timing(shakeAnim, {toValue: -10, duration: 50, useNativeDriver: true}),
            Animated.timing(shakeAnim, {toValue: 10, duration: 50, useNativeDriver: true}),
            Animated.timing(shakeAnim, {toValue: 0, duration: 50, useNativeDriver: true}),
        ]).start();
    }, [shouldShake]);

    if (!editing || !isVisible) return null;

    const {editingValue, promptText, secureTextEntry} = editing;
    const displayText = secureTextEntry ? '•'.repeat(editingValue.length) : editingValue;

    return (
        <View style={styles.container}>
            {promptText && (
                <View style={styles.promptContainer}>
                    <Text style={styles.promptText}>{promptText}</Text>
                </View>
            )}
            <Animated.View style={[styles.contentContainer, {transform: [{translateX: shakeAnim}]}]}>
                <Text style={styles.editingText}>{displayText}</Text>
                <Animated.View style={[styles.cursor, {opacity: cursorOpacity}]}/>
            </Animated.View>
        </View>
    );
});

const styles = StyleSheet.create({
    container: {
        height: 80,
        backgroundColor: '#F8F9FA',
        justifyContent: 'center',
        alignItems: 'center',
        borderBottomWidth: 1,
        borderBottomColor: '#E2E8F0',
        position: 'relative',
    },
    promptContainer: {position: 'absolute', left: 24, top: 0, bottom: 0, justifyContent: 'center'},
    promptText: {fontSize: 18, fontWeight: '600', color: '#64748B'},
    contentContainer: {flexDirection: 'row', alignItems: 'center', justifyContent: 'center'},
    editingText: {fontSize: 28, fontWeight: '700', color: '#020617', letterSpacing: 1},
    cursor: {width: 2, height: 32, backgroundColor: '#020617', marginLeft: 2},
});
