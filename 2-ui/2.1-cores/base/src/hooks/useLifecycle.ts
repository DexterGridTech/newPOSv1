import { useEffect, useRef } from 'react';
import {moduleName} from "../moduleName";
import {LOG_TAGS, logger} from "@impos2/kernel-core-base";

/**
 * Lifecycle Hook 配置接口
 */
export interface UseLifecycleConfig {
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
     * 在组件卸载时调用
     */
    onClearance: () => void;
}

export const useLifecycle = (config: UseLifecycleConfig): void => {
    const { componentName, onInitiated, onClearance } = config;

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
     * 组件卸载时的清理
     */
    useEffect(() => {
        return () => {
            // 组件卸载时，如果还没有触发过清理，则触发一次
            if (!hasCleanedRef.current) {
                const componentName = getComponentName();
                logger.log([moduleName,LOG_TAGS.Hook,'useLifecycle'],`卸载：${componentName}`)
                onClearance();
                hasCleanedRef.current = true;
            }
        };
    }, [onClearance]);
};
