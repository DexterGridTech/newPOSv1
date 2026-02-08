import { useEffect, useRef } from 'react';
import {LOG_TAGS, logger} from "@impos2/kernel-base";
import {moduleName} from "../moduleName";

/**
 * Lifecycle Hook 配置接口
 */
export interface UseLifecycleConfig {
    /**
     * 组件是否可见
     */
    isVisible: boolean;
    /**
     * 组件名称（可选）
     * 用于日志输出，便于调试
     */
    componentName?: string;
    /**
     * 初始化回调函数（可选）
     * 在组件首次挂载完成时调用
     */
    onInitiated?: () => void;
    /**
     * 清理回调函数
     * 在组件卸载或变为不可见时调用
     */
    onClearance: () => void;
}

/**
 * 通用生命周期 Hook
 *
 * 职责：
 * 1. 在组件首次挂载完成时触发初始化回调
 * 2. 监听组件的可见性状态
 * 3. 在组件卸载时触发清理回调
 * 4. 在组件从可见变为不可见时触发清理回调
 * 5. 防止重复触发清理回调
 * 6. 打印组件名称，便于调试
 *
 * @param config - 配置对象
 *
 * @example
 * ```typescript
 * const componentRef = useRef(null);
 *
 * useLifecycle({
 *   isVisible: modalOpen,
 *   componentRef: componentRef,
 *   onInitiated: () => {
 *     console.log('组件初始化完成');
 *     // 初始化逻辑
 *   },
 *   onClearance: () => {
 *     console.log('清理资源');
 *     // 清理逻辑
 *   }
 * });
 * ```
 */
export const useLifecycle = (config: UseLifecycleConfig): void => {
    const { isVisible, componentName, onInitiated, onClearance } = config;

    // 追踪上一次的可见状态
    const prevVisibleRef = useRef<boolean>(isVisible);

    // 追踪是否已经触发过清理
    const hasCleanedRef = useRef<boolean>(false);

    // 追踪是否已经触发过初始化
    const hasInitiatedRef = useRef<boolean>(false);

    // 获取组件名称
    const getComponentName = (): string => {
        return componentName || 'Unknown Component';
    };

    /**
     * 组件首次挂载时的初始化
     */
    useEffect(() => {
        if (onInitiated && !hasInitiatedRef.current) {
            const componentName = getComponentName();
            logger.log([moduleName,LOG_TAGS.Hook,'useLifecycle'],`加载：${componentName}`)
            onInitiated();
            hasInitiatedRef.current = true;
        }
    }, [onInitiated]);

    /**
     * 监听可见性变化
     */
    useEffect(() => {
        const prevVisible = prevVisibleRef.current;
        const currentVisible = isVisible;

        // 从可见变为不可见时触发清理
        if (prevVisible && !currentVisible && !hasCleanedRef.current) {
            const componentName = getComponentName();
            logger.log([moduleName,LOG_TAGS.Hook,'useLifecycle'],`不可见：${componentName}`)
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
                const componentName = getComponentName();
                logger.log([moduleName,LOG_TAGS.Hook,'useLifecycle'],`卸载：${componentName}`)
                onClearance();
            }
        };
    }, [onClearance]);
};
