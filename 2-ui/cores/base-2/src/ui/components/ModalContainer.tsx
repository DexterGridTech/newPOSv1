import React, {useCallback, useEffect, useMemo, useRef, useState} from "react";
import {getScreenPartComponentType, LOG_TAGS, logger, ModalScreen, useUiModels, formattedTime} from "@impos2/kernel-base";
import {moduleName} from "../../moduleName";

/**
 * Modal 子项接口
 */
interface ModalChild {
    ComponentType: React.ComponentType<any>;
    model: ModalScreen<any>;
    isClosing: boolean; // 标记是否正在关闭（播放关闭动画）
}

/**
 * ModalContainer 组件
 *
 * 职责：
 * 1. 管理多个 Modal 的显示和隐藏
 * 2. 监听 Modal 列表变化并更新页面
 * 3. 管理组件生命周期和资源释放
 * 4. 提供详细的错误信息和调试日志
 * 5. 处理 Modal 关闭动画：当 Modal 从 state 中删除时，先播放关闭动画，然后再从视图中移除
 */
export const ModalContainer: React.FC = React.memo(() => {
    // 获取当前所有 Modal
    const models = useUiModels();

    // 使用 state 管理正在关闭的 Modal（需要播放关闭动画）
    const [closingModals, setClosingModals] = useState<Map<string, ModalScreen<any>>>(new Map());

    // 使用 ref 追踪上一次的 models，用于检测变化
    const prevModelsRef = useRef<ModalScreen<any>[]>([]);

    // 使用 ref 追踪组件挂载状态
    const isMountedRef = useRef<boolean>(true);

    // 使用 ref 追踪当前显示的 Modal IDs
    const currentModalIdsRef = useRef<Set<string>>(new Set());

    // 关闭动画时长（毫秒）
    const CLOSE_ANIMATION_DURATION = 800;

    /**
     * 打印详细的 Modal 信息
     */
    const logModalInfo = useCallback((model: ModalScreen<any>, action: 'open' | 'close') => {
        const timestamp = formattedTime();
        const modalInfo = {
            action,
            timestamp,
            id: model.id || 'undefined',
            partKey: model.partKey || 'undefined',
            props: model.props ? Object.keys(model.props) : [],
            propsCount: model.props ? Object.keys(model.props).length : 0
        };

        logger.log([moduleName, LOG_TAGS.UI, 'ModalContainer'], `Modal ${action.toUpperCase()}`, modalInfo);
    }, []);

    /**
     * 打印详细的错误信息
     */
    const logComponentNotFound = useCallback((model: ModalScreen<any>) => {
        const errorInfo = {
            timestamp: formattedTime(),
            id: model.id || 'undefined',
            partKey: model.partKey || 'undefined',
            props: model.props || {},
            availableComponents: 'Check registered ScreenParts',
            suggestion: 'Ensure the component is registered via registerScreenPart()'
        };

        logger.error([moduleName, LOG_TAGS.UI, 'ModalContainer'], 'Component not found', errorInfo);

        // 额外打印更详细的调试信息
        logger.debug([moduleName, LOG_TAGS.UI, 'ModalContainer'], 'Debug Info', {
            modelObject: model,
            modelType: typeof model,
            modelKeys: model ? Object.keys(model) : []
        });
    }, []);

    /**
     * 使用 useMemo 缓存 Modal 子项列表，包含正在显示的和正在关闭的
     */
    const children = useMemo<ModalChild[]>(() => {
        const validChildren: ModalChild[] = [];

        // 1. 处理当前显示的 Modal
        if (models && models.length > 0) {
            models.forEach((model) => {
                if (!model || !model.partKey) {
                    logger.warn([moduleName, LOG_TAGS.UI, 'ModalContainer'], 'Invalid model', {model});
                    return;
                }

                const ComponentType = getScreenPartComponentType(model.partKey);

                if (!ComponentType) {
                    logComponentNotFound(model);
                    return;
                }

                validChildren.push({
                    ComponentType,
                    model,
                    isClosing: false,
                });
            });
        }

        // 2. 处理正在关闭的 Modal（播放关闭动画）
        closingModals.forEach((model, id) => {
            const ComponentType = getScreenPartComponentType(model.partKey);

            if (ComponentType) {
                validChildren.push({
                    ComponentType,
                    model: {
                        ...model,
                        open: false, // 设置 open 为 false，触发关闭动画
                    },
                    isClosing: true,
                });
            }
        });

        return validChildren;
    }, [models, closingModals, logComponentNotFound]);

    /**
     * 监听 Modal 列表变化，处理关闭动画
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

        // 检测关闭的 Modal - 不立即删除，而是先播放关闭动画
        prevIds.forEach((id) => {
            if (!currentIds.has(id)) {
                const model = prevModels.find(m => m.id === id);
                if (model) {
                    logModalInfo(model, 'close');

                    // 将 Modal 添加到 closingModals，开始播放关闭动画
                    setClosingModals((prev) => {
                        const newMap = new Map(prev);
                        newMap.set(id as string, model);
                        return newMap;
                    });

                    // 在动画时长后，从 closingModals 中移除
                    setTimeout(() => {
                        setClosingModals((prev) => {
                            const newMap = new Map(prev);
                            newMap.delete(id as string);
                            return newMap;
                        });

                        if (id) {
                            currentModalIdsRef.current.delete(id);
                        }
                    }, CLOSE_ANIMATION_DURATION);
                }
            }
        });

        // 记录 Modal 数量变化
        if (prevModels.length !== currentModels.length) {
            logger.log([moduleName, LOG_TAGS.UI, 'ModalContainer'], 'Modal count changed', {
                from: prevModels.length,
                to: currentModels.length,
                closingCount: closingModals.size,
                timestamp: formattedTime()
            });
        }

        // 更新 ref
        prevModelsRef.current = currentModels;
    }, [models, logModalInfo, closingModals.size, CLOSE_ANIMATION_DURATION]);

    /**
     * 组件挂载时的生命周期
     */
    useEffect(() => {
        isMountedRef.current = true;

        logger.debug([moduleName, LOG_TAGS.UI, 'ModalContainer'], 'Container mounted', {
            initialModalCount: models.length,
            timestamp: formattedTime()
        });

        // 组件卸载时的清理函数
        return () => {
            isMountedRef.current = false;

            // 记录卸载信息
            if (currentModalIdsRef.current.size > 0) {
                logger.debug([moduleName, LOG_TAGS.UI, 'ModalContainer'], 'Container unmounting', {
                    openModals: Array.from(currentModalIdsRef.current),
                    timestamp: formattedTime()
                });
            }

            // 清理 refs 和 state
            prevModelsRef.current = [];
            currentModalIdsRef.current.clear();
            setClosingModals(new Map());

            logger.debug([moduleName, LOG_TAGS.UI, 'ModalContainer'], 'Container unmounted and resources released');
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
                const {ComponentType, model} = child;
                const key = model.id || model.partKey;

                logger.debug([moduleName, LOG_TAGS.System, 'ModalContainer'], 'Rendering modal', {
                    key,
                    model,
                    ComponentType
                });

                if (!key) {
                    logger.warn([moduleName, LOG_TAGS.System, 'ModalContainer'], 'Modal without id or partKey', {model});
                    return null;
                }

                // 传递整个 model 对象，而不是只传递 model.props
                return <ComponentType key={key} {...model} />;
            })}
        </>
    );
});
