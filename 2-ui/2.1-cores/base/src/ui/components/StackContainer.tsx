import React, {useCallback, useEffect, useMemo, useRef} from "react";
import {EmptyScreen} from "../screens/EmptyScreen";
import {moduleName} from "../../moduleName";
import {getScreenPartComponentType, UiVariable, useChildScreenPart} from "@impos2/kernel-core-navigation";
import {formattedTime, LOG_TAGS, logger, ScreenPart} from "@impos2/kernel-core-base";

export interface StackContainerProps {
    containerPart: UiVariable<ScreenPart<any>>
}

/**
 * StackContainer 组件
 *
 * 职责：
 * 1. 根据 containerPart 动态渲染子组件
 * 2. 监听 child 变化并更新页面
 * 3. 管理组件生命周期和资源释放
 * 4. 提供详细的错误信息和调试日志
 */
export const StackContainer: React.FC<StackContainerProps> = React.memo(({
                                                                             containerPart
                                                                         }) => {
    // 获取当前子 ScreenPart
    const child = useChildScreenPart(containerPart);

    // 使用 ref 追踪上一次的 child，用于检测变化
    const prevChildRef = useRef<ScreenPart<any> | null>(null);

    // 使用 ref 追踪组件挂载状态
    const isMountedRef = useRef<boolean>(true);

    // 使用 ref 追踪当前渲染的组件实例
    const currentComponentRef = useRef<string | null>(null);

    /**
     * 打印详细的 child 信息
     */
    const logChildInfo = useCallback((child: ScreenPart<any>, action: 'mount' | 'update' | 'unmount') => {
        const timestamp = formattedTime();
        const childInfo = {
            action,
            timestamp,
            partKey: child?.partKey || 'undefined',
            props: child?.props ? Object.keys(child.props) : [],
            propsCount: child?.props ? Object.keys(child.props).length : 0,
            containerPartKey: containerPart?.key || 'undefined'
        };

        logger.log([moduleName, LOG_TAGS.UI, 'StackContainer'], action.toUpperCase(), childInfo);
    }, [containerPart]);

    /**
     * 打印详细的错误信息
     */
    const logComponentNotFound = useCallback((child: ScreenPart<any>) => {
        const errorInfo = {
            timestamp: formattedTime(),
            partKey: child?.partKey || 'undefined',
            containerPartKey: containerPart?.key || 'undefined',
            props: child?.props || {},
            availableComponents: 'Check registered ScreenParts',
            suggestion: 'Ensure the component is registered via registerScreenPart()'
        };

        logger.error([moduleName, LOG_TAGS.UI, 'StackContainer'], 'Component not found', errorInfo);

        // 额外打印更详细的调试信息
        logger.debug([moduleName, LOG_TAGS.UI, 'StackContainer'], 'Debug Info', {
            childObject: child,
            childType: typeof child,
            childKeys: child ? Object.keys(child) : [],
            containerPart: containerPart
        });
    }, [containerPart]);

    /**
     * 使用 useMemo 缓存组件类型，避免重复查找
     */
    const ComponentType = useMemo(() => {
        if (!child || !child.partKey) {
            logger.warn([moduleName, LOG_TAGS.UI, 'StackContainer'], 'Invalid child', {child});
            return EmptyScreen;
        }
        const component = getScreenPartComponentType(child.partKey);

        if (!component) {
            logComponentNotFound(child);
            return EmptyScreen;
        }

        return component;
    }, [child, logComponentNotFound]);

    /**
     * 监听 child 变化
     */
    useEffect(() => {
        if (!isMountedRef.current) return;

        const prevChild = prevChildRef.current;
        const currentChild = child;

        // 首次挂载
        if (!prevChild && currentChild) {
            logChildInfo(currentChild, 'mount');
            currentComponentRef.current = currentChild.partKey;
        }
        // child 发生变化
        else if (prevChild && currentChild && prevChild.partKey !== currentChild.partKey) {
            logger.log([moduleName, LOG_TAGS.UI, 'StackContainer'], 'Child changed', {
                from: prevChild.partKey,
                to: currentChild.partKey,
                timestamp: formattedTime()
            });

            logChildInfo(currentChild, 'update');
            currentComponentRef.current = currentChild.partKey;
        }
        // child 被移除
        else if (prevChild && !currentChild) {
            logChildInfo(prevChild, 'unmount');
            currentComponentRef.current = null;
        }

        // 更新 ref
        prevChildRef.current = currentChild;
    }, [child, logChildInfo]);

    /**
     * 组件挂载时的生命周期
     */
    useEffect(() => {
        isMountedRef.current = true;

        logger.log([moduleName, LOG_TAGS.UI, 'StackContainer'], 'Container mounted', {
            containerPartKey: containerPart?.key || 'undefined',
            timestamp: formattedTime()
        });

        // 组件卸载时的清理函数
        return () => {
            isMountedRef.current = false;

            // 记录卸载信息
            if (currentComponentRef.current) {
                logger.log([moduleName, LOG_TAGS.UI, 'StackContainer'], 'Container unmounting', {
                    lastComponent: currentComponentRef.current,
                    timestamp: formattedTime()
                });
            }

            // 清理 refs
            prevChildRef.current = null;
            currentComponentRef.current = null;

            logger.log([moduleName, LOG_TAGS.UI, 'StackContainer'], 'Container unmounted and resources released');
        };
    }, [containerPart]);

    /**
     * 渲染组件
     */
    if (!child) {
        logger.warn([moduleName, LOG_TAGS.UI, 'StackContainer'], 'No child to render', {
            containerPartKey: containerPart?.key || 'undefined'
        });
        return <EmptyScreen/>;
    }

    // 渲染实际组件
    return <ComponentType {...child.props} />;
}, (prevProps, nextProps) => {
    // 自定义比较函数，只有当 containerPart 的值真正改变时才重新渲染
    return prevProps.containerPart === nextProps.containerPart;
});
