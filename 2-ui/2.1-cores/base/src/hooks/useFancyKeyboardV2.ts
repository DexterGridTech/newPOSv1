import {useContext} from 'react';
import {FancyKeyboardContextV2, FancyKeyboardContextValueV2} from '../contexts/FancyKeyboardContextV2';

/**
 * 使用 FancyKeyboard V2 的 Hook
 */
export function useFancyKeyboardV2(): FancyKeyboardContextValueV2 {
    const context = useContext(FancyKeyboardContextV2);
    if (!context) {
        throw new Error('useFancyKeyboardV2 must be used within a FancyKeyboardProviderV2');
    }
    return context;
}
