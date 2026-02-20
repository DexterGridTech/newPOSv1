import React, {createContext, useCallback, useState, ReactNode, useMemo} from 'react';
import {Dimensions} from 'react-native';

/**
 * 激活的输入框信息
 */
export interface ActiveInputInfo {
    id: string;
    value: string;
    position: {x: number; y: number; width: number; height: number};
    initialPosition: {x: number; y: number; width: number; height: number}; // 初始位置，用于 Backdrop 挖空
    onChangeText: (text: string) => void;
    onSubmit?: () => void;
}

/**
 * 键盘状态
 */
export interface FancyKeyboardState {
    isVisible: boolean;
    keyboardType: 'full' | 'number';
    activeInput: ActiveInputInfo | null;
    containerOffset: number;
    animationConfig: {
        duration: number;
        easing: string;
    };
}

/**
 * 键盘上下文值
 */
export interface FancyKeyboardContextValue extends FancyKeyboardState {
    showKeyboard: (inputInfo: ActiveInputInfo, keyboardType: 'full' | 'number') => void;
    hideKeyboard: () => void;
    updateInputValue: (value: string) => void;
    updateInputPosition: (position: {x: number; y: number; width: number; height: number}) => void;
}

/**
 * Provider Props
 */
export interface FancyKeyboardProviderProps {
    children: ReactNode;
    animationDuration?: number;
    animationEasing?: string;
    keyboardHeight?: number;
}

// 创建 Context
export const FancyKeyboardContext = createContext<FancyKeyboardContextValue | undefined>(undefined);

/**
 * FancyKeyboardProvider 组件
 */
export const FancyKeyboardProvider: React.FC<FancyKeyboardProviderProps> = ({
    children,
    animationDuration = 150,
    animationEasing = 'easeInOut',
    keyboardHeight,
}) => {
    const screenHeight = Dimensions.get('window').height;

    const [state, setState] = useState<FancyKeyboardState>({
        isVisible: false,
        keyboardType: 'full',
        activeInput: null,
        containerOffset: 0,
        animationConfig: {
            duration: animationDuration,
            easing: animationEasing,
        },
    });

    /**
     * 计算容器偏移量 - 简化版本
     */
    const calculateContainerOffset = useCallback(
        (inputPosition: {y: number; height: number}): number => {
            const keyboardHeight = (screenHeight * 2) / 5;
            const keyboardTop = screenHeight - keyboardHeight;
            const inputBottom = inputPosition.y + inputPosition.height;

            // 添加50px的缓冲区域，避免输入框太靠近键盘
            const bufferZone = 50;
            const safeZoneTop = keyboardTop - bufferZone;

            // 如果输入框会被键盘遮挡（包含缓冲区域）
            if (inputBottom > safeZoneTop) {
                // 将输入框移到屏幕上方1/3处
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
        (inputInfo: ActiveInputInfo, keyboardType: 'full' | 'number') => {
            const offset = calculateContainerOffset(inputInfo.position);

            // 使用函数式更新，避免不必要的重渲染
            setState((prev) => {
                // 如果已经显示且类型相同，只更新必要的字段
                if (prev.isVisible && prev.keyboardType === keyboardType) {
                    return {
                        ...prev,
                        activeInput: inputInfo,
                        containerOffset: offset,
                    };
                }

                // 如果键盘未显示，或者键盘类型不同，则立即显示键盘
                // 不需要延迟，让用户感觉响应更快
                return {
                    ...prev,
                    keyboardType,
                    activeInput: inputInfo,
                    containerOffset: offset,
                    isVisible: true, // 立即显示键盘
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
        setState((prev) => {
            // 调用 onSubmit 回调
            if (prev.activeInput?.onSubmit) {
                prev.activeInput.onSubmit();
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
     * 更新输入值
     */
    const updateInputValue = useCallback((value: string) => {
        setState((prev) => {
            if (prev.activeInput) {
                // 直接同步调用回调，避免密码输入时字符短暂显示明文
                prev.activeInput.onChangeText(value);

                return {
                    ...prev,
                    activeInput: {...prev.activeInput, value},
                };
            }
            return prev;
        });
    }, []);

    /**
     * 更新输入框位置（用于输入过程中位置变化）
     * 注意：只更新 position，不重新计算 containerOffset
     * 因为 container 已经移动到位了，只需要让 MaskedView 的挖空位置跟随即可
     */
    const updateInputPosition = useCallback((position: {x: number; y: number; width: number; height: number}) => {
        setState((prev) => {
            if (prev.activeInput) {
                return {
                    ...prev,
                    activeInput: {...prev.activeInput, position},
                    // 不重新计算 containerOffset，保持 container 位置不变
                };
            }
            return prev;
        });
    }, []);

    const contextValue: FancyKeyboardContextValue = useMemo(
        () => ({
            ...state,
            showKeyboard,
            hideKeyboard,
            updateInputValue,
            updateInputPosition,
        }),
        [state, showKeyboard, hideKeyboard, updateInputValue, updateInputPosition]
    );

    return (
        <FancyKeyboardContext.Provider value={contextValue}>
            {children}
        </FancyKeyboardContext.Provider>
    );
};
