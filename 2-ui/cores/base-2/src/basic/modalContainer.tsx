import React, { useEffect, useRef, useMemo, useCallback } from "react";
import { getScreenPartComponentType, useUiModels, ModalScreen } from "@impos2/kernel-module-ui-navigation";
import { EmptyScreen } from "./emptyScreen";
import { logger } from "@impos2/kernel-base";

/**
 * Modal 子项接口
 */
interface ModalChild {
    ComponentType: React.ComponentType<any>;
    model: ModalScreen<any>;
}

/**
 * ModalContainer 组件
 *
 * 职责：
 * 1. 管理多个 Modal 的显示和隐藏
 * 2. 监听 Modal 列表变化并更新页面
 * 3. 管理组件生命周期和资源释放
 * 4. 提供详细的错误信息和调试日志
 */
export const ModalContainer: React.FC = React.memo(() => {
    // 获取当前所有 Modal
    const models = useUiModels();

    // 使用 ref 追踪上一次的 models，用于检测变化
    const prevModelsRef = useRef<ModalScreen<any>[]>([]);

    // 使用 ref 追踪组件挂载状态
    const isMountedRef = useRef<boolean>(true);

    // 使用 ref 追踪当前显示的 Modal IDs
    const currentModalIdsRef = useRef<Set<string>>(new Set());

    /**
     * 打印详细的 Modal 信息
     */
    const logModalInfo = useCallback((model: ModalScreen<any>, action: 'open' | 'close') => {
        const timestamp = new Date().toISOString();
        const modalInfo = {
            action,
            timestamp,
            id: model.id || 'undefined',
            partKey: model.partKey || 'undefined',
            props: model.props ? Object.keys(model.props) : [],
            propsCount: model.props ? Object.keys(model.props).length : 0
        };

        logger.log(`[ModalContainer] Modal ${action.toUpperCase()}`, modalInfo);
    }, []);

    /**
     * 打印详细的错误信息
     */
    const logComponentNotFound = useCallback((model: ModalScreen<any>) => {
        const errorInfo = {
            timestamp: new Date().toISOString(),
            id: model.id || 'undefined',
            partKey: model.partKey || 'undefined',
            props: model.props || {},
            availableComponents: 'Check registered ScreenParts',
            suggestion: 'Ensure the component is registered via registerScreenPart()'
        };

        logger.error('[ModalContainer] Component not found', errorInfo);

        // 额外打印更详细的调试信息
        logger.debug('[ModalContainer] Debug Info', {
            modelObject: model,
            modelType: typeof model,
            modelKeys: model ? Object.keys(model) : []
        });
    }, []);

    /**
     * 使用 useMemo 缓存 Modal 子项列表，避免重复处理
     */
    const children = useMemo<ModalChild[]>(() => {
        if (!models || models.length === 0) {
            return [];
        }

        const validChildren: ModalChild[] = [];

        models.forEach((model) => {
            if (!model || !model.partKey) {
                logger.warn('[ModalContainer] Invalid model', { model });
                return;
            }

            const ComponentType = getScreenPartComponentType(model.partKey);

            if (!ComponentType) {
                logComponentNotFound(model);
                return;
            }

            validChildren.push({
                ComponentType,
                model
            });
        });

        return validChildren;
    }, [models, logComponentNotFound]);

    /**
     * 监听 Modal 列表变化
     */
    useEffect(() => {
        if (!isMountedRef.current) return;

        const prevModels = prevModelsRef.current;
        const currentModels = models;

        // 获取之前和当前的 Modal IDs
        const prevIds = new Set(prevModels.map(m => m.id).filter(Boolean));
        const currentIds = new Set(currentModels.map(m => m.id).filter(Boolean));

        // 检测新打开的 Modal
        currentIds.forEach((id) => {
            if (!prevIds.has(id)) {
                const model = currentModels.find(m => m.id === id);
                if (model) {
                    logModalInfo(model, 'open');
                    currentModalIdsRef.current.add(id as string);
                }
            }
        });

        // 检测关闭的 Modal
        prevIds.forEach((id) => {
            if (!currentIds.has(id)) {
                const model = prevModels.find(m => m.id === id);
                if (model) {
                    logModalInfo(model, 'close');
                    if (id) {
                        currentModalIdsRef.current.delete(id);
                    }
                }
            }
        });

        // 记录 Modal 数量变化
        if (prevModels.length !== currentModels.length) {
            logger.log('[ModalContainer] Modal count changed', {
                from: prevModels.length,
                to: currentModels.length,
                timestamp: new Date().toISOString()
            });
        }

        // 更新 ref
        prevModelsRef.current = currentModels;
    }, [models, logModalInfo]);

    /**
     * 组件挂载时的生命周期
     */
    useEffect(() => {
        isMountedRef.current = true;

        logger.debug('[ModalContainer] Container mounted', {
            initialModalCount: models.length,
            timestamp: new Date().toISOString()
        });

        // 组件卸载时的清理函数
        return () => {
            isMountedRef.current = false;

            // 记录卸载信息
            if (currentModalIdsRef.current.size > 0) {
                logger.debug('[ModalContainer] Container unmounting', {
                    openModals: Array.from(currentModalIdsRef.current),
                    timestamp: new Date().toISOString()
                });
            }

            // 清理 refs
            prevModelsRef.current = [];
            currentModalIdsRef.current.clear();

            logger.debug('[ModalContainer] Container unmounted and resources released');
        };
    }, [models.length]);

    /**
     * 渲染 Modal 列表
     */
    if (children.length === 0) {
        return null;
    }

    return (
        <>
            {children.map((child) => {
                const { ComponentType, model } = child;
                const key = model.id || model.partKey;

                if (!key) {
                    logger.warn('[ModalContainer] Modal without id or partKey', { model });
                    return null;
                }

                return <ComponentType key={key} {...model.props} />;
            })}
        </>
    );
});
