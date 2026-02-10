import React, {useState, useCallback, useImperativeHandle, forwardRef, useRef} from 'react';
import {View, Animated} from 'react-native';
import {KeyButton} from './KeyButton';
import {FULL_KEYBOARD_LOWERCASE, FULL_KEYBOARD_UPPERCASE} from './keyLayouts';
import {styles} from './styles';

interface FancyFullKeyBoardProps {
    onKeyPress: (key: string) => void;
}

export interface FancyFullKeyBoardRef {
    shakeConfirmButton: () => void;
}

/**
 * 全键盘组件
 */
export const FancyFullKeyBoard = React.memo(
    forwardRef<FancyFullKeyBoardRef, FancyFullKeyBoardProps>(({onKeyPress}, ref) => {
        const [isUpperCase, setIsUpperCase] = useState(false);
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
                if (value === 'SHIFT') {
                    setIsUpperCase((prev) => !prev);
                } else {
                    onKeyPress(value);
                }
            },
            [onKeyPress]
        );

        const keyLayout = isUpperCase ? FULL_KEYBOARD_UPPERCASE : FULL_KEYBOARD_LOWERCASE;

        return (
            <View style={styles.container}>
                <View style={styles.keysContainer}>
                    {keyLayout.map((row, rowIndex) => (
                        <View key={rowIndex} style={styles.row}>
                            {row.map((key, keyIndex) => (
                                <KeyButton
                                    key={`${rowIndex}-${keyIndex}`}
                                    keyConfig={key}
                                    onPress={handleKeyPress}
                                />
                            ))}
                        </View>
                    ))}
                </View>
                <Animated.View
                    style={[
                        styles.confirmContainer,
                        {
                            transform: [{translateX: shakeAnim}],
                        },
                    ]}
                >
                    <KeyButton
                        keyConfig={{label: '确认', value: 'CONFIRM', type: 'function', flex: 2}}
                        onPress={handleKeyPress}
                        isFullHeight
                    />
                </Animated.View>
            </View>
        );
    })
);
