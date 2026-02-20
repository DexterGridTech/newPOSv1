import {useContext} from 'react';
import {FancyKeyboardContext, FancyKeyboardContextValue} from '../contexts/FancyKeyboardContext';

/**
 * 使用 FancyKeyboard 的 Hook
 * 提供键盘状态和控制方法
 */
export function useFancyKeyboard(): FancyKeyboardContextValue {
    const context = useContext(FancyKeyboardContext);

    if (!context) {
        throw new Error('useFancyKeyboard must be used within FancyKeyboardProvider');
    }

    return context;
}
