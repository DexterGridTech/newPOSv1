import { useEffect, useRef } from 'react';

/**
 * Clearance Hook 配置接口
 */
export interface UseClearanceConfig {
    /**
     * 组件是否可见
     */
    isVisible: boolean;
    /**
     * 清理回调函数
     * 在组件卸载或变为不可见时调用
     */
    onClearance: () => void;
}

/**
 * 通用清理 Hook
 *
 * 职责：
 * 1. 监听组件的可见性状态
 * 2. 在组件卸载时触发清理回调
 * 3. 在组件从可见变为不可见时触发清理回调
 * 4. 防止重复触发清理回调
 *
 * @param config - 配置对象
 *
 * @example
 * ```typescript
 * useClearance({
 *   isVisible: modalOpen,
 *   onClearance: () => {
 *     console.log('清理资源');
 *     // 清理逻辑
 *   }
 * });
 * ```
 */
export const useClearance = (config: UseClearanceConfig): void => {
    const { isVisible, onClearance } = config;

    // 追踪上一次的可见状态
    const prevVisibleRef = useRef<boolean>(isVisible);

    // 追踪是否已经触发过清理
    const hasCleanedRef = useRef<boolean>(false);

    /**
     * 监听可见性变化
     */
    useEffect(() => {
        const prevVisible = prevVisibleRef.current;
        const currentVisible = isVisible;

        // 从可见变为不可见时触发清理
        if (prevVisible && !currentVisible && !hasCleanedRef.current) {
            onClearance();
            hasCleanedRef.current = true;
        }

        // 从不可见变为可见时重置清理标记
        if (!prevVisible && currentVisible) {
            hasCleanedRef.current = false;
        }

        // 更新上一次的状态
        prevVisibleRef.current = currentVisible;
    }, [isVisible, onClearance]);

    /**
     * 组件卸载时的清理
     */
    useEffect(() => {
        return () => {
            // 组件卸载时，如果还没有触发过清理，则触发一次
            if (!hasCleanedRef.current) {
                onClearance();
            }
        };
    }, [onClearance]);
};
