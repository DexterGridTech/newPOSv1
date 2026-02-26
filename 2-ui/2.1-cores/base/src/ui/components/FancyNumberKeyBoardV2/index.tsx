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

// ─── Design Tokens ───────────────────────────────────────────────────────────
const T = {
    // 底盘
    bg: '#E8ECF0',
    // 普通数字键
    keyBg: '#FFFFFF',
    keyText: '#1A2332',
    keyRadius: 10,
    keyElevation: 2,
    // 删除键
    deleteBg: '#CBD5E1',
    deleteText: '#334155',
    // 确认键
    confirmBg: '#16A34A',
    confirmText: '#FFFFFF',
    // 取消键
    cancelBg: '#DC2626',
    cancelText: '#FFFFFF',
    // 关闭键
    closeBg: '#94A3B8',
    closeText: '#FFFFFF',
    // 字体
    fontNum: 28 as const,
    fontAction: 16 as const,
    fontDelete: 22 as const,
    fontWeight600: '600' as const,
    fontWeight700: '700' as const,
};

const styles = StyleSheet.create({
    wrapper: {
        flex: 1,
        alignItems: 'center',
        backgroundColor: T.bg,
    },
    card: {
        width: KEYBOARD_WIDTH,
        flex: 1,
        flexDirection: 'row',
        gap: GAP,
        padding: PADDING,
        backgroundColor: T.bg,
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
        backgroundColor: T.keyBg,
        borderRadius: T.keyRadius,
        justifyContent: 'center',
        alignItems: 'center',
        elevation: T.keyElevation,
    },
    keyText: {
        fontSize: T.fontNum,
        fontWeight: T.fontWeight600,
        color: T.keyText,
    },
    deleteKey: {
        backgroundColor: T.deleteBg,
    },
    deleteKeyText: {
        fontSize: T.fontDelete,
        fontWeight: T.fontWeight700,
        color: T.deleteText,
    },
    actionButtons: {
        width: ACTION_WIDTH,
        gap: GAP,
    },
    cancelButton: {
        flex: 1,
        backgroundColor: T.cancelBg,
        borderRadius: T.keyRadius,
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 3,
    },
    cancelButtonText: {
        fontSize: T.fontAction,
        fontWeight: T.fontWeight700,
        color: T.cancelText,
    },
    closeButton: {
        flex: 1,
        backgroundColor: T.closeBg,
        borderRadius: T.keyRadius,
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 2,
    },
    closeButtonText: {
        fontSize: T.fontAction,
        fontWeight: T.fontWeight700,
        color: T.closeText,
    },
    confirmButton: {
        backgroundColor: T.confirmBg,
        borderRadius: T.keyRadius,
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 4,
    },
    confirmButtonText: {
        fontSize: T.fontAction,
        fontWeight: T.fontWeight700,
        color: T.confirmText,
    },
});
