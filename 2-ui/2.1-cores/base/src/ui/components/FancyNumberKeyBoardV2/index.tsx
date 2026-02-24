import React, {memo, useCallback, useEffect, useRef} from 'react';
import {View, TouchableOpacity, Text, StyleSheet, Animated, Platform, Dimensions} from 'react-native';

const {width: screenWidth} = Dimensions.get('window');

// 键盘主体最大宽度：大屏居中，小屏自适应
const KEYBOARD_MAX_WIDTH = 460;
const KEYBOARD_WIDTH = Math.min(screenWidth * 0.88, KEYBOARD_MAX_WIDTH);
const ACTION_WIDTH = 84;
const GAP = 8;
const PADDING = 10;

interface FancyNumberKeyBoardV2Props {
    onKeyPress: (key: string) => void;
    onCancel: () => void;
    onConfirm: () => void;
    shouldShake?: boolean;
    hasChanges?: boolean;
}

const NumKey = memo<{label: string; value: string; onKeyPress: (v: string) => void; style?: any; textStyle?: any}>(
    ({label, value, onKeyPress, style, textStyle}) => {
        const handlePress = useCallback(() => onKeyPress(value), [onKeyPress, value]);
        return (
            <TouchableOpacity style={[styles.key, style]} onPress={handlePress} activeOpacity={0.55}>
                <Text style={[styles.keyText, textStyle]}>{label}</Text>
            </TouchableOpacity>
        );
    }
);

const ActionButtons = memo<{
    hasChanges: boolean;
    shouldShake: boolean;
    onCancel: () => void;
    onConfirm: () => void;
}>(({hasChanges, shouldShake, onCancel, onConfirm}) => {
    const shakeAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (shouldShake) {
            const useNative = Platform.OS !== 'web';
            Animated.sequence([
                Animated.timing(shakeAnim, {toValue: 8, duration: 50, useNativeDriver: useNative}),
                Animated.timing(shakeAnim, {toValue: -8, duration: 50, useNativeDriver: useNative}),
                Animated.timing(shakeAnim, {toValue: 8, duration: 50, useNativeDriver: useNative}),
                Animated.timing(shakeAnim, {toValue: -8, duration: 50, useNativeDriver: useNative}),
                Animated.timing(shakeAnim, {toValue: 0, duration: 50, useNativeDriver: useNative}),
            ]).start();
        }
    }, [shouldShake]);

    if (!hasChanges) {
        return (
            <TouchableOpacity style={styles.closeButton} onPress={onCancel} activeOpacity={0.7}>
                <Text style={styles.closeButtonText}>关闭</Text>
            </TouchableOpacity>
        );
    }
    return (
        <>
            <TouchableOpacity style={styles.cancelButton} onPress={onCancel} activeOpacity={0.7}>
                <Text style={styles.cancelButtonText}>取消</Text>
            </TouchableOpacity>
            <Animated.View style={{flex: 1, transform: [{translateX: shakeAnim}]}}>
                <TouchableOpacity style={[styles.confirmButton, StyleSheet.absoluteFillObject]} onPress={onConfirm} activeOpacity={0.7}>
                    <Text style={styles.confirmButtonText}>确认</Text>
                </TouchableOpacity>
            </Animated.View>
        </>
    );
});

export const FancyNumberKeyBoardV2: React.FC<FancyNumberKeyBoardV2Props> = memo(
    ({onKeyPress, onCancel, onConfirm, shouldShake = false, hasChanges = false}) => {
        return (
            <View style={styles.wrapper}>
                <View style={styles.card}>
                    <View style={styles.keyboardMain}>
                        <View style={styles.row}>
                            <NumKey label="1" value="1" onKeyPress={onKeyPress}/>
                            <NumKey label="2" value="2" onKeyPress={onKeyPress}/>
                            <NumKey label="3" value="3" onKeyPress={onKeyPress}/>
                        </View>
                        <View style={styles.row}>
                            <NumKey label="4" value="4" onKeyPress={onKeyPress}/>
                            <NumKey label="5" value="5" onKeyPress={onKeyPress}/>
                            <NumKey label="6" value="6" onKeyPress={onKeyPress}/>
                        </View>
                        <View style={styles.row}>
                            <NumKey label="7" value="7" onKeyPress={onKeyPress}/>
                            <NumKey label="8" value="8" onKeyPress={onKeyPress}/>
                            <NumKey label="9" value="9" onKeyPress={onKeyPress}/>
                        </View>
                        <View style={styles.row}>
                            <NumKey label="." value="." onKeyPress={onKeyPress}/>
                            <NumKey label="0" value="0" onKeyPress={onKeyPress}/>
                            <NumKey
                                label="⌫"
                                value="DELETE"
                                onKeyPress={onKeyPress}
                                style={styles.deleteKey}
                                textStyle={styles.deleteKeyText}
                            />
                        </View>
                    </View>
                    <View style={styles.actionButtons}>
                        <ActionButtons
                            hasChanges={hasChanges}
                            shouldShake={shouldShake}
                            onCancel={onCancel}
                            onConfirm={onConfirm}
                        />
                    </View>
                </View>
            </View>
        );
    }
);

const styles = StyleSheet.create({
    // 全宽背景，水平居中
    wrapper: {
        flex: 1,
        alignItems: 'center',
        backgroundColor: '#F1F5F9',
    },
    // 固定宽度卡片，两侧自动留白，高度撑满父容器
    card: {
        width: KEYBOARD_WIDTH,
        flex: 1,
        flexDirection: 'row',
        gap: GAP,
        padding: PADDING,
        backgroundColor: '#F1F5F9',
        borderRadius: 16,
    },
    keyboardMain: {
        flex: 1,
        gap: GAP,
    },
    row: {
        flexDirection: 'row',
        gap: GAP,
        flex: 1,
    },
    key: {
        flex: 1,
        backgroundColor: '#FFFFFF',
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#94A3B8',
        shadowOffset: {width: 0, height: 2},
        shadowOpacity: 0.18,
        shadowRadius: 3,
        elevation: 3,
    },
    keyText: {
        fontSize: 26,
        fontWeight: '600',
        color: '#1E293B',
    },
    deleteKey: {
        backgroundColor: '#E2E8F0',
    },
    deleteKeyText: {
        fontSize: 22,
        fontWeight: '700',
        color: '#475569',
    },
    actionButtons: {
        width: ACTION_WIDTH,
        gap: GAP,
    },
    cancelButton: {
        flex: 1,
        backgroundColor: '#FEE2E2',
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#EF4444',
        shadowOffset: {width: 0, height: 2},
        shadowOpacity: 0.15,
        shadowRadius: 3,
        elevation: 2,
    },
    cancelButtonText: {
        fontSize: 15,
        fontWeight: '700',
        color: '#EF4444',
    },
    closeButton: {
        flex: 1,
        backgroundColor: '#E2E8F0',
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#94A3B8',
        shadowOffset: {width: 0, height: 2},
        shadowOpacity: 0.15,
        shadowRadius: 3,
        elevation: 2,
    },
    closeButtonText: {
        fontSize: 15,
        fontWeight: '700',
        color: '#64748B',
    },
    confirmButton: {
        backgroundColor: '#10B981',
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#10B981',
        shadowOffset: {width: 0, height: 3},
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 4,
    },
    confirmButtonText: {
        fontSize: 15,
        fontWeight: '700',
        color: '#FFFFFF',
    },
});
