import React, {createContext, useCallback, useState, ReactNode, useMemo, useRef, useEffect} from 'react';
import {Dimensions} from 'react-native';

const getKeyboardHeight = () => {
    const {width, height} = Dimensions.get('window');
    const isLandscape = width > height;
    const shortEdge = Math.min(width, height);
    const isTablet = shortEdge >= 600;
    if (isLandscape) {
        return isTablet ? height * 0.5 : height * 0.55;
    }
    return isTablet ? height * 0.35 : height * 0.4;
};

export interface ActiveInputInfoV2 {
    id: string;
    value: string;
    editingValue: string;
    position: {x: number; y: number; width: number; height: number};
    initialPosition: {x: number; y: number; width: number; height: number};
    onChangeText: (text: string) => void;
    onSubmit?: () => void;
    promptText?: string;
    maxLength?: number;
    secureTextEntry?: boolean;
}

// ─── 拆分为三个 Context ───────────────────────────────────────────────────────
// 1. 稳定 Context：actions + 不频繁变化的状态（isVisible/keyboardType/containerOffset）
// 2. 编辑 Context：editingValue 高频变化，只让 EditingContent 订阅

export interface FancyKeyboardActionsV2 {
    showKeyboard: (inputInfo: ActiveInputInfoV2, keyboardType: 'full' | 'number') => void;
    hideKeyboard: () => void;
    updateEditingValue: (value: string) => void;
    confirmInput: () => void;
    cancelInput: () => void;
    updateInputPosition: (position: {x: number; y: number; width: number; height: number}) => void;
    shakeConfirmButton: () => void;
}

export interface FancyKeyboardDisplayStateV2 {
    isVisible: boolean;
    keyboardType: 'full' | 'number';
    activeInput: ActiveInputInfoV2 | null;
    containerOffset: number;
    shouldShakeConfirmButton: boolean;
}

// editingValue 单独一个 context，只有 EditingContent 订阅
export interface FancyKeyboardEditingV2 {
    editingValue: string;
    promptText?: string;
    secureTextEntry?: boolean;
    maxLength?: number;
    hasChanges: boolean;
}

export const FancyKeyboardActionsContextV2 = createContext<FancyKeyboardActionsV2 | undefined>(undefined);
export const FancyKeyboardDisplayContextV2 = createContext<FancyKeyboardDisplayStateV2 | undefined>(undefined);
export const FancyKeyboardEditingContextV2 = createContext<FancyKeyboardEditingV2 | undefined>(undefined);

// 保留旧 context 名兼容 useFancyKeyboardV2 hook
export interface FancyKeyboardContextValueV2 extends FancyKeyboardDisplayStateV2, FancyKeyboardActionsV2 {}
export const FancyKeyboardContextV2 = createContext<FancyKeyboardContextValueV2 | undefined>(undefined);

export interface FancyKeyboardProviderV2Props {
    children: ReactNode;
}

export const FancyKeyboardProviderV2: React.FC<FancyKeyboardProviderV2Props> = ({
    children,
}) => {
    const [screenHeight, setScreenHeight] = useState(() => Dimensions.get('window').height);

    // 显示状态（isVisible/keyboardType/activeInput/containerOffset）
    const [displayState, setDisplayState] = useState<FancyKeyboardDisplayStateV2>({
        isVisible: false,
        keyboardType: 'full',
        activeInput: null,
        containerOffset: 0,
        shouldShakeConfirmButton: false,
    });

    useEffect(() => {
        const subscription = Dimensions.addEventListener('change', ({window}) => {
            setScreenHeight(window.height);

            // 屏幕旋转时，如果键盘打开且有 activeInput，重新计算 containerOffset
            setDisplayState((prev) => {
                if (!prev.isVisible || !prev.activeInput) return prev;

                const kbHeight = getKeyboardHeight();
                const keyboardTop = window.height - kbHeight - 80;
                const inputBottom = prev.activeInput.position.y + prev.activeInput.position.height;
                const offset = inputBottom > keyboardTop - 50
                    ? -(prev.activeInput.position.y - window.height / 3)
                    : 0;

                return {...prev, containerOffset: offset};
            });
        });
        return () => subscription?.remove();
    }, []);

    // editingValue 单独 state，避免每次按键触发 displayState 更新
    const [editingState, setEditingState] = useState<FancyKeyboardEditingV2>({
        editingValue: '',
        promptText: undefined,
        secureTextEntry: false,
        maxLength: undefined,
        hasChanges: false,
    });

    // 用 ref 持有 activeInput 的原始 value，用于 hasChanges 计算
    const originalValueRef = useRef<string>('');

    const showKeyboard = useCallback(
        (inputInfo: ActiveInputInfoV2, keyboardType: 'full' | 'number') => {
            const {width, height} = Dimensions.get('window');
            const kbHeight = getKeyboardHeight();
            const currentScreenHeight = Dimensions.get('window').height;
            const keyboardTop = currentScreenHeight - kbHeight - 80;
            const inputBottom = inputInfo.position.y + inputInfo.position.height;
            const offset = inputBottom > keyboardTop - 50
                ? -(inputInfo.position.y - currentScreenHeight / 3)
                : 0;

            originalValueRef.current = inputInfo.value;

            setDisplayState((prev) => ({
                ...prev,
                keyboardType,
                activeInput: inputInfo,
                containerOffset: offset,
                isVisible: true,
            }));

            setEditingState({
                editingValue: inputInfo.editingValue,
                promptText: inputInfo.promptText,
                secureTextEntry: inputInfo.secureTextEntry,
                maxLength: inputInfo.maxLength,
                hasChanges: false,
            });
        },
        []
    );

    const hideKeyboard = useCallback(() => {
        setDisplayState((prev) => ({
            ...prev,
            isVisible: false,
            containerOffset: 0,
            activeInput: null,
        }));
        setEditingState({editingValue: '', promptText: undefined, secureTextEntry: false, maxLength: undefined, hasChanges: false});
    }, []);

    // 高频调用：只更新 editingState，不碰 displayState
    const updateEditingValue = useCallback((value: string) => {
        setEditingState((prev) => ({
            ...prev,
            editingValue: value,
            hasChanges: value !== originalValueRef.current,
        }));
    }, []);

    // ref 跟踪最新 editingValue，供 confirmInput 读取（必须在 confirmInput 之前声明）
    const editingValueRef = useRef('');
    editingValueRef.current = editingState.editingValue;

    // confirmInput 回调 timer ref，防止组件卸载后仍触发
    const confirmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const confirmInput = useCallback(() => {
        setDisplayState((prev) => {
            if (prev.activeInput) {
                const {onChangeText, onSubmit} = prev.activeInput;
                const currentEditing = editingValueRef.current;
                if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
                confirmTimerRef.current = setTimeout(() => {
                    onChangeText(currentEditing);
                    onSubmit?.();
                }, 0);
            }
            return {...prev, isVisible: false, containerOffset: 0, activeInput: null};
        });
        setEditingState({editingValue: '', promptText: undefined, secureTextEntry: false, maxLength: undefined, hasChanges: false});
    }, []);

    // cancelInput 即 hideKeyboard，无需额外包装
    const cancelInput = hideKeyboard;

    const updateInputPosition = useCallback((position: {x: number; y: number; width: number; height: number}) => {
        setDisplayState((prev) => {
            if (!prev.activeInput) return prev;
            return {...prev, activeInput: {...prev.activeInput, position}};
        });
    }, []);

    // shakeConfirmButton timer ref，防止泄漏
    const shakeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const shakeConfirmButton = useCallback(() => {
        if (shakeTimerRef.current) clearTimeout(shakeTimerRef.current);
        setDisplayState((prev) => ({...prev, shouldShakeConfirmButton: true}));
        shakeTimerRef.current = setTimeout(() => {
            setDisplayState((prev) => ({...prev, shouldShakeConfirmButton: false}));
        }, 500);
    }, []);

    // cancelInput === hideKeyboard（同一引用），无需单独列入依赖
    const actions = useMemo<FancyKeyboardActionsV2>(
        () => ({showKeyboard, hideKeyboard, updateEditingValue, confirmInput, cancelInput, updateInputPosition, shakeConfirmButton}),
        [showKeyboard, hideKeyboard, updateEditingValue, confirmInput, updateInputPosition, shakeConfirmButton]
    );

    // 兼容旧 hook 的合并 context
    const legacyContextValue = useMemo<FancyKeyboardContextValueV2>(
        () => ({...displayState, ...actions}),
        [displayState, actions]
    );

    return (
        <FancyKeyboardContextV2.Provider value={legacyContextValue}>
            <FancyKeyboardActionsContextV2.Provider value={actions}>
                <FancyKeyboardDisplayContextV2.Provider value={displayState}>
                    <FancyKeyboardEditingContextV2.Provider value={editingState}>
                        {children}
                    </FancyKeyboardEditingContextV2.Provider>
                </FancyKeyboardDisplayContextV2.Provider>
            </FancyKeyboardActionsContextV2.Provider>
        </FancyKeyboardContextV2.Provider>
    );
};
