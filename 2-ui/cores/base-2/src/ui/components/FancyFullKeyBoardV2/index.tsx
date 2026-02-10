import React, {useState, useCallback, useEffect, useRef} from 'react';
import {View, TouchableOpacity, Text, StyleSheet, Animated, Platform} from 'react-native';

interface FancyFullKeyBoardV2Props {
    onKeyPress: (key: string) => void;
    onCancel: () => void;
    onConfirm: () => void;
    shouldShake?: boolean;
    hasChanges?: boolean;
}

/**
 * 全键盘组件 V2 - 专业 POS 风格
 * 特点：
 * 1. 4 行布局，切换前后按键数量和位置完全一致
 * 2. 初始显示字母键盘
 * 3. 切换后显示数字+符号键盘
 * 4. 右侧整合取消/确定按钮
 */
export const FancyFullKeyBoardV2: React.FC<FancyFullKeyBoardV2Props> = (
    ({onKeyPress, onCancel, onConfirm, shouldShake = false, hasChanges = false}) => {
        const [isUpperCase, setIsUpperCase] = useState(false);
        const [isSymbolMode, setIsSymbolMode] = useState(false);

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
                if (value === 'SHIFT') {
                    setIsUpperCase((prev) => !prev);
                } else if (value === 'SYMBOL') {
                    setIsSymbolMode((prev) => !prev);
                } else {
                    onKeyPress(value);
                    // 输入后自动切换回小写
                    if (isUpperCase && value.length === 1 && /[a-zA-Z]/.test(value)) {
                        setIsUpperCase(false);
                    }
                }
            },
            [onKeyPress, isUpperCase]
        );

        // 键盘布局 - 字母模式（前3行每行10个按键）
        const letterLayout = {
            row1: isUpperCase
                ? ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P']
                : ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
            row2: isUpperCase
                ? ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', '@']
                : ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', '@'],
            row3: isUpperCase
                ? ['Z', 'X', 'C', 'V', 'B', 'N', 'M', '.', '-', '_']
                : ['z', 'x', 'c', 'v', 'b', 'n', 'm', '.', '-', '_'],
        };

        // 键盘布局 - 数字符号模式（4行，每行10个按键）
        const symbolLayout = {
            row1: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
            row2: ['!', '@', '#', '$', '%', '^', '&', '*', '(', ')'],
            row3: ['-', '_', '=', '+', '[', ']', '{', '}', '|', '\\'],
            row4: ['/', ':', ';', '"', "'", '<', '>', '?', ',', '.'],
        };

        return (
            <View style={styles.container}>
                {/* 左侧：键盘主体 */}
                <View style={styles.keyboardMain}>
                    {/* 第一行 */}
                    <View style={styles.row}>
                        {(isSymbolMode ? symbolLayout.row1 : letterLayout.row1).map((key, index) => (
                            <TouchableOpacity
                                key={`row1-${index}`}
                                style={styles.key}
                                onPress={() => handleKeyPress(key)}
                                activeOpacity={0.6}
                            >
                                <Text style={styles.keyText}>{key}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    {/* 第二行 */}
                    <View style={styles.row}>
                        {(isSymbolMode ? symbolLayout.row2 : letterLayout.row2).map((key, index) => (
                            <TouchableOpacity
                                key={`row2-${index}`}
                                style={styles.key}
                                onPress={() => handleKeyPress(key)}
                                activeOpacity={0.6}
                            >
                                <Text style={styles.keyText}>{key}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    {/* 第三行 */}
                    <View style={styles.row}>
                        {(isSymbolMode ? symbolLayout.row3 : letterLayout.row3).map((key, index) => (
                            <TouchableOpacity
                                key={`row3-${index}`}
                                style={styles.key}
                                onPress={() => handleKeyPress(key)}
                                activeOpacity={0.6}
                            >
                                <Text style={styles.keyText}>{key}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    {/* 第四行 */}
                    <View style={styles.row}>
                        {isSymbolMode ? (
                            // 符号模式：ABC返回键 + 符号（9个） + 删除键
                            <>
                                {/* ABC 返回字母键盘 */}
                                <TouchableOpacity
                                    style={[styles.key, styles.functionKey]}
                                    onPress={() => handleKeyPress('SYMBOL')}
                                    activeOpacity={0.6}
                                >
                                    <Text style={styles.functionKeyText}>ABC</Text>
                                </TouchableOpacity>

                                {/* 符号按键 */}
                                {symbolLayout.row4.slice(0, 8).map((key, index) => (
                                    <TouchableOpacity
                                        key={`row4-${index}`}
                                        style={styles.key}
                                        onPress={() => handleKeyPress(key)}
                                        activeOpacity={0.6}
                                    >
                                        <Text style={styles.keyText}>{key}</Text>
                                    </TouchableOpacity>
                                ))}

                                {/* 删除键 */}
                                <TouchableOpacity
                                    style={[styles.key, styles.functionKey]}
                                    onPress={() => handleKeyPress('DELETE')}
                                    activeOpacity={0.6}
                                >
                                    <Text style={styles.functionKeyText}>⌫</Text>
                                </TouchableOpacity>
                            </>
                        ) : (
                            // 字母模式：Shift + 123# + 空格 + 删除（4个视觉按键，空格占6份）
                            <>
                                {/* Shift 键 */}
                                <TouchableOpacity
                                    style={[styles.key, styles.functionKey, isUpperCase && styles.activeShift]}
                                    onPress={() => handleKeyPress('SHIFT')}
                                    activeOpacity={0.6}
                                >
                                    <Text style={[styles.functionKeyText, isUpperCase && styles.activeShiftText]}>
                                        ⇧
                                    </Text>
                                </TouchableOpacity>

                                {/* 符号切换键 */}
                                <TouchableOpacity
                                    style={[styles.key, styles.functionKey, isSymbolMode && styles.activeSymbol]}
                                    onPress={() => handleKeyPress('SYMBOL')}
                                    activeOpacity={0.6}
                                >
                                    <Text style={[styles.functionKeyText, isSymbolMode && styles.activeSymbolText]}>
                                        123#
                                    </Text>
                                </TouchableOpacity>

                                {/* 空格键（占6份宽度）*/}
                                <TouchableOpacity
                                    style={[styles.key, styles.spaceKey]}
                                    onPress={() => handleKeyPress(' ')}
                                    activeOpacity={0.6}
                                >
                                    <Text style={styles.keyText}>空格</Text>
                                </TouchableOpacity>

                                {/* 删除键 */}
                                <TouchableOpacity
                                    style={[styles.key, styles.functionKey]}
                                    onPress={() => handleKeyPress('DELETE')}
                                    activeOpacity={0.6}
                                >
                                    <Text style={styles.functionKeyText}>⌫</Text>
                                </TouchableOpacity>
                            </>
                        )}
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
        borderRadius: 6,
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
        fontSize: 20,
        fontWeight: '600',
        color: '#1F2937',
    },
    functionKey: {
        backgroundColor: '#6B7280',
    },
    functionKeyText: {
        fontSize: 18,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    spaceKey: {
        flex: 6,
    },
    activeShift: {
        backgroundColor: '#3B82F6',
    },
    activeShiftText: {
        color: '#FFFFFF',
    },
    activeSymbol: {
        backgroundColor: '#3B82F6',
    },
    activeSymbolText: {
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
