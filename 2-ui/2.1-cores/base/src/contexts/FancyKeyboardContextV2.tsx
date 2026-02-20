import React, {createContext, useCallback, useState, ReactNode, useMemo} from 'react';
import {Dimensions} from 'react-native';

/**
 * 激活的输入框信息 V2
 */
export interface ActiveInputInfoV2 {
    id: string;
    value: string;
    editingValue: string; // 正在编辑的值
    position: {x: number; y: number; width: number; height: number};
    initialPosition: {x: number; y: number; width: number; height: number};
    onChangeText: (text: string) => void;
    onSubmit?: () => void;
    promptText?: string; // 提示文本
    maxLength?: number; // 最大长度
    secureTextEntry?: boolean; // 是否密码模式
}

/**
 * 键盘状态 V2
 */
export interface FancyKeyboardStateV2 {
    isVisible: boolean;
    keyboardType: 'full' | 'number';
    activeInput: ActiveInputInfoV2 | null;
    containerOffset: number;
    animationConfig: {
        duration: number;
        easing: string;
    };
}

/**
 * 键盘上下文值 V2
 */
export interface FancyKeyboardContextValueV2 extends FancyKeyboardStateV2 {
    showKeyboard: (inputInfo: ActiveInputInfoV2, keyboardType: 'full' | 'number') => void;
    hideKeyboard: () => void;
    updateEditingValue: (value: string) => void;
    confirmInput: () => void;
    cancelInput: () => void;
    updateInputPosition: (position: {x: number; y: number; width: number; height: number}) => void;
    shakeConfirmButton: () => void;
    shouldShakeConfirmButton: boolean;
}

/**
 * Provider Props V2
 */
export interface FancyKeyboardProviderV2Props {
    children: ReactNode;
    animationDuration?: number;
    animationEasing?: string;
    keyboardHeight?: number;
}

// 创建 Context
export const FancyKeyboardContextV2 = createContext<FancyKeyboardContextValueV2 | undefined>(undefined);

/**
 * FancyKeyboardProviderV2 组件
 */
export const FancyKeyboardProviderV2: React.FC<FancyKeyboardProviderV2Props> = ({
    children,
    animationDuration = 150,
    animationEasing = 'easeInOut',
    keyboardHeight,
}) => {
    const screenHeight = Dimensions.get('window').height;

    const [state, setState] = useState<FancyKeyboardStateV2>({
        isVisible: false,
        keyboardType: 'full',
        activeInput: null,
        containerOffset: 0,
        animationConfig: {
            duration: animationDuration,
            easing: animationEasing,
        },
    });

    const [shouldShakeConfirmButton, setShouldShakeConfirmButton] = useState(false);

    /**
     * 计算容器偏移量
     */
    const calculateContainerOffset = useCallback(
        (inputPosition: {y: number; height: number}): number => {
            const keyboardHeight = (screenHeight * 2) / 5;
            const editingContentHeight = 80; // editingContent 固定高度
            const totalKeyboardHeight = keyboardHeight + editingContentHeight;
            const keyboardTop = screenHeight - totalKeyboardHeight;
            const inputBottom = inputPosition.y + inputPosition.height;

            const bufferZone = 50;
            const safeZoneTop = keyboardTop - bufferZone;

            if (inputBottom > safeZoneTop) {
                const targetY = screenHeight / 3;
                const offset = -(inputPosition.y - targetY);
                return offset;
            }

            return 0;
        },
        [screenHeight]
    );

    /**
     * 显示键盘
     */
    const showKeyboard = useCallback(
        (inputInfo: ActiveInputInfoV2, keyboardType: 'full' | 'number') => {
            const offset = calculateContainerOffset(inputInfo.position);

            setState((prev) => {
                if (prev.isVisible && prev.keyboardType === keyboardType) {
                    return {
                        ...prev,
                        activeInput: inputInfo,
                        containerOffset: offset,
                    };
                }

                return {
                    ...prev,
                    keyboardType,
                    activeInput: inputInfo,
                    containerOffset: offset,
                    isVisible: true,
                    animationConfig: prev.animationConfig,
                };
            });
        },
        [calculateContainerOffset]
    );

    /**
     * 隐藏键盘
     */
    const hideKeyboard = useCallback(() => {
        setState((prev) => ({
            ...prev,
            isVisible: false,
            containerOffset: 0,
            activeInput: null,
        }));
    }, []);

    /**
     * 更新编辑中的值
     */
    const updateEditingValue = useCallback((value: string) => {
        setState((prev) => {
            if (prev.activeInput) {
                return {
                    ...prev,
                    activeInput: {...prev.activeInput, editingValue: value},
                };
            }
            return prev;
        });
    }, []);

    /**
     * 确认输入
     */
    const confirmInput = useCallback(() => {
        // 先保存当前的 activeInput 信息
        setState((prev) => {
            if (prev.activeInput) {
                // 在 setState 外部调用回调，避免在渲染过程中触发其他组件的 setState
                const {onChangeText, editingValue, onSubmit} = prev.activeInput;

                // 使用 setTimeout 确保在下一个事件循环中执行
                setTimeout(() => {
                    onChangeText(editingValue);
                    if (onSubmit) {
                        onSubmit();
                    }
                }, 0);
            }

            return {
                ...prev,
                isVisible: false,
                containerOffset: 0,
                activeInput: null,
            };
        });
    }, []);

    /**
     * 取消输入
     */
    const cancelInput = useCallback(() => {
        hideKeyboard();
    }, [hideKeyboard]);

    /**
     * 更新输入框位置
     */
    const updateInputPosition = useCallback((position: {x: number; y: number; width: number; height: number}) => {
        setState((prev) => {
            if (prev.activeInput) {
                return {
                    ...prev,
                    activeInput: {...prev.activeInput, position},
                };
            }
            return prev;
        });
    }, []);

    /**
     * 抖动确定按钮
     */
    const shakeConfirmButton = useCallback(() => {
        setShouldShakeConfirmButton(true);
        setTimeout(() => {
            setShouldShakeConfirmButton(false);
        }, 500);
    }, []);

    const contextValue: FancyKeyboardContextValueV2 = useMemo(
        () => ({
            ...state,
            showKeyboard,
            hideKeyboard,
            updateEditingValue,
            confirmInput,
            cancelInput,
            updateInputPosition,
            shakeConfirmButton,
            shouldShakeConfirmButton,
        }),
        [state, showKeyboard, hideKeyboard, updateEditingValue, confirmInput, cancelInput, updateInputPosition, shakeConfirmButton, shouldShakeConfirmButton]
    );

    return (
        <FancyKeyboardContextV2.Provider value={contextValue}>
            {children}
        </FancyKeyboardContextV2.Provider>
    );
};
