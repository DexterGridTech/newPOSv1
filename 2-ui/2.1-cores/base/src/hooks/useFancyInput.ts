import {useRef, useCallback, useState} from 'react';
import {TextInput} from 'react-native';
import {useFancyKeyboard} from './useFancyKeyboard';
import {ActiveInputInfo} from '../contexts/FancyKeyboardContext';

/**
 * FancyInput Hook 返回值
 */
export interface UseFancyInputReturn {
    inputRef: React.RefObject<TextInput>;
    handlePress: () => void;
    value: string;
    onChangeText: (text: string) => void;
}

/**
 * FancyInput 的核心逻辑 Hook
 */
export function useFancyInput(
    initialValue: string,
    keyboardType: 'full' | 'number',
    onSubmit?: () => void
): UseFancyInputReturn {
    const inputRef = useRef<TextInput>(null);
    const [value, setValue] = useState(initialValue);
    const {showKeyboard} = useFancyKeyboard();

    /**
     * 处理点击事件
     */
    const handlePress = useCallback(() => {
        if (inputRef.current) {
            inputRef.current.measureInWindow((x, y, width, height) => {
                const inputInfo: ActiveInputInfo = {
                    id: Math.random().toString(36).substr(2, 9),
                    value,
                    position: {x, y, width, height},
                    initialPosition: {x, y, width, height}, // 保存初始位置
                    onChangeText: setValue,
                    onSubmit,
                };

                showKeyboard(inputInfo, keyboardType);
            });
        }
    }, [value, keyboardType, onSubmit, showKeyboard]);

    /**
     * 处理文本变化
     */
    const onChangeText = useCallback((text: string) => {
        setValue(text);
    }, []);

    return {
        inputRef,
        handlePress,
        value,
        onChangeText,
    };
}
