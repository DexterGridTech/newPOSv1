import React, {useCallback, useEffect, useRef} from 'react';
import {View, TouchableOpacity, Text, StyleSheet, Animated, Platform} from 'react-native';

interface FancyNumberKeyBoardV2Props {
    onKeyPress: (key: string) => void;
    onCancel: () => void;
    onConfirm: () => void;
    shouldShake?: boolean;
    hasChanges?: boolean;
}

/**
 * 数字键盘组件 V2 - 专业 POS 风格
 * 特点：
 * 1. 4x4 布局，充分利用 263px 高度
 * 2. 右侧整合取消/确定按钮
 * 3. 经典计算器布局
 * 4. 横屏平板优化
 */
export const FancyNumberKeyBoardV2: React.FC<FancyNumberKeyBoardV2Props> = (
    ({onKeyPress, onCancel, onConfirm, shouldShake = false, hasChanges = false}) => {
        // 确定按钮抖动动画
        const shakeAnim = useRef(new Animated.Value(0)).current;

        useEffect(() => {
            if (shouldShake) {
                const useNative = Platform.OS !== 'web';
                // 抖动动画：左右摇摆
                Animated.sequence([
                    Animated.timing(shakeAnim, {
                        toValue: 10,
                        duration: 50,
                        useNativeDriver: useNative,
                    }),
                    Animated.timing(shakeAnim, {
                        toValue: -10,
                        duration: 50,
                        useNativeDriver: useNative,
                    }),
                    Animated.timing(shakeAnim, {
                        toValue: 10,
                        duration: 50,
                        useNativeDriver: useNative,
                    }),
                    Animated.timing(shakeAnim, {
                        toValue: -10,
                        duration: 50,
                        useNativeDriver: useNative,
                    }),
                    Animated.timing(shakeAnim, {
                        toValue: 0,
                        duration: 50,
                        useNativeDriver: useNative,
                    }),
                ]).start();
            }
        }, [shouldShake]); // 移除 shakeAnim 依赖

        const handleKeyPress = useCallback(
            (value: string) => {
                onKeyPress(value);
            },
            [onKeyPress]
        );

        return (
            <View style={styles.container}>
                {/* 左侧：数字键盘主体 */}
                <View style={styles.keyboardMain}>
                    {/* 第一行: 7 8 9 */}
                    <View style={styles.row}>
                        <TouchableOpacity style={styles.key} onPress={() => handleKeyPress('7')} activeOpacity={0.6}>
                            <Text style={styles.keyText}>7</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.key} onPress={() => handleKeyPress('8')} activeOpacity={0.6}>
                            <Text style={styles.keyText}>8</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.key} onPress={() => handleKeyPress('9')} activeOpacity={0.6}>
                            <Text style={styles.keyText}>9</Text>
                        </TouchableOpacity>
                    </View>

                    {/* 第二行: 4 5 6 */}
                    <View style={styles.row}>
                        <TouchableOpacity style={styles.key} onPress={() => handleKeyPress('4')} activeOpacity={0.6}>
                            <Text style={styles.keyText}>4</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.key} onPress={() => handleKeyPress('5')} activeOpacity={0.6}>
                            <Text style={styles.keyText}>5</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.key} onPress={() => handleKeyPress('6')} activeOpacity={0.6}>
                            <Text style={styles.keyText}>6</Text>
                        </TouchableOpacity>
                    </View>

                    {/* 第三行: 1 2 3 */}
                    <View style={styles.row}>
                        <TouchableOpacity style={styles.key} onPress={() => handleKeyPress('1')} activeOpacity={0.6}>
                            <Text style={styles.keyText}>1</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.key} onPress={() => handleKeyPress('2')} activeOpacity={0.6}>
                            <Text style={styles.keyText}>2</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.key} onPress={() => handleKeyPress('3')} activeOpacity={0.6}>
                            <Text style={styles.keyText}>3</Text>
                        </TouchableOpacity>
                    </View>

                    {/* 第四行: . 0 删除 */}
                    <View style={styles.row}>
                        <TouchableOpacity style={styles.key} onPress={() => handleKeyPress('.')} activeOpacity={0.6}>
                            <Text style={styles.keyText}>.</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.key} onPress={() => handleKeyPress('0')} activeOpacity={0.6}>
                            <Text style={styles.keyText}>0</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.key, styles.deleteKey]}
                            onPress={() => handleKeyPress('DELETE')}
                            activeOpacity={0.6}
                        >
                            <Text style={styles.deleteKeyText}>⌫</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* 右侧：取消/确定按钮 */}
                <View style={styles.actionButtons}>
                    {hasChanges ? (
                        // 有变化：显示取消和确定按钮
                        <>
                            <TouchableOpacity style={styles.cancelButton} onPress={onCancel} activeOpacity={0.7}>
                                <Text style={styles.cancelButtonText}>取消</Text>
                            </TouchableOpacity>
                            <Animated.View style={{flex: 1, transform: [{translateX: shakeAnim}]}}>
                                <TouchableOpacity style={styles.confirmButton} onPress={onConfirm} activeOpacity={0.7}>
                                    <Text style={styles.confirmButtonText}>确定</Text>
                                </TouchableOpacity>
                            </Animated.View>
                        </>
                    ) : (
                        // 无变化：只显示关闭按钮，占据整个区域
                        <TouchableOpacity style={styles.closeButtonFull} onPress={onCancel} activeOpacity={0.7}>
                            <Text style={styles.closeButtonText}>关闭</Text>
                        </TouchableOpacity>
                    )}
                </View>
            </View>
        );
    }
);

const styles = StyleSheet.create({
    container: {
        flex: 1,
        flexDirection: 'row',
        backgroundColor: '#E5E7EB',
        padding: 6,
        gap: 6,
    },
    keyboardMain: {
        flex: 1,
        justifyContent: 'space-between',
    },
    row: {
        flexDirection: 'row',
        gap: 6,
        height: 60,
    },
    key: {
        flex: 1,
        backgroundColor: '#FFFFFF',
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: {width: 0, height: 1},
        shadowOpacity: 0.1,
        shadowRadius: 1,
        elevation: 2,
        borderWidth: 1,
        borderColor: '#D1D5DB',
    },
    keyText: {
        fontSize: 32,
        fontWeight: '700',
        color: '#1F2937',
    },
    deleteKey: {
        backgroundColor: '#6B7280',
    },
    deleteKeyText: {
        fontSize: 28,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    actionButtons: {
        width: 100,
        gap: 6,
    },
    cancelButton: {
        flex: 1,
        backgroundColor: '#EF4444',
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: {width: 0, height: 2},
        shadowOpacity: 0.2,
        shadowRadius: 2,
        elevation: 3,
    },
    cancelButtonText: {
        fontSize: 18,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    closeButtonFull: {
        flex: 1,
        backgroundColor: '#FCA5A5', // 淡红色
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: {width: 0, height: 2},
        shadowOpacity: 0.2,
        shadowRadius: 2,
        elevation: 3,
    },
    closeButtonText: {
        fontSize: 18,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    confirmButton: {
        flex: 1,
        backgroundColor: '#10B981',
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: {width: 0, height: 2},
        shadowOpacity: 0.2,
        shadowRadius: 2,
        elevation: 3,
    },
    confirmButtonText: {
        fontSize: 18,
        fontWeight: '700',
        color: '#FFFFFF',
    },
});
