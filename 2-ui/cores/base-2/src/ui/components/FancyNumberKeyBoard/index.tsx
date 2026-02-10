import React, {useCallback, useImperativeHandle, forwardRef, useRef} from 'react';
import {View, Animated} from 'react-native';
import {KeyButton} from './KeyButton';
import {styles} from './styles';

interface FancyNumberKeyBoardProps {
    onKeyPress: (key: string) => void;
}

export interface FancyNumberKeyBoardRef {
    shakeConfirmButton: () => void;
}

/**
 * 数字键盘组件
 */
export const FancyNumberKeyBoard = React.memo(
    forwardRef<FancyNumberKeyBoardRef, FancyNumberKeyBoardProps>(({onKeyPress}, ref) => {
        const shakeAnim = useRef(new Animated.Value(0)).current;

        useImperativeHandle(ref, () => ({
            shakeConfirmButton: () => {
                Animated.sequence([
                    Animated.timing(shakeAnim, {
                        toValue: 10,
                        duration: 50,
                        useNativeDriver: true,
                    }),
                    Animated.timing(shakeAnim, {
                        toValue: -10,
                        duration: 50,
                        useNativeDriver: true,
                    }),
                    Animated.timing(shakeAnim, {
                        toValue: 10,
                        duration: 50,
                        useNativeDriver: true,
                    }),
                    Animated.timing(shakeAnim, {
                        toValue: 0,
                        duration: 50,
                        useNativeDriver: true,
                    }),
                ]).start();
            },
        }));

        const handleKeyPress = useCallback(
            (value: string) => {
                onKeyPress(value);
            },
            [onKeyPress]
        );

        return (
            <View style={styles.container}>
                <View style={styles.keysContainer}>
                    {/* 第一行: 1 2 3 */}
                    <View style={styles.row}>
                        <KeyButton label="1" value="1" onPress={handleKeyPress} />
                        <KeyButton label="2" value="2" onPress={handleKeyPress} />
                        <KeyButton label="3" value="3" onPress={handleKeyPress} />
                    </View>

                    {/* 第二行: 4 5 6 */}
                    <View style={styles.row}>
                        <KeyButton label="4" value="4" onPress={handleKeyPress} />
                        <KeyButton label="5" value="5" onPress={handleKeyPress} />
                        <KeyButton label="6" value="6" onPress={handleKeyPress} />
                    </View>

                    {/* 第三行: 7 8 9 */}
                    <View style={styles.row}>
                        <KeyButton label="7" value="7" onPress={handleKeyPress} />
                        <KeyButton label="8" value="8" onPress={handleKeyPress} />
                        <KeyButton label="9" value="9" onPress={handleKeyPress} />
                    </View>

                    {/* 第四行: . 0 删除 */}
                    <View style={styles.row}>
                        <KeyButton label="." value="." onPress={handleKeyPress} />
                        <KeyButton label="0" value="0" onPress={handleKeyPress} />
                        <KeyButton label="⌫" value="DELETE" onPress={handleKeyPress} isFunction />
                    </View>
                </View>
                <Animated.View
                    style={[
                        styles.confirmContainer,
                        {
                            transform: [{translateX: shakeAnim}],
                        },
                    ]}
                >
                    <KeyButton label="确认" value="CONFIRM" onPress={handleKeyPress} isConfirm isFullHeight />
                </Animated.View>
            </View>
        );
    })
);
