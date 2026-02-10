import React, {useEffect, useRef, useState} from "react";
import {getScreenPartComponentType, LOG_TAGS, logger, ModalScreen, useUiModels} from "@impos2/kernel-base";
import {moduleName} from "../../moduleName";

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
 * 1. 从 state 中获取最新的 children，本地也缓存一份 children
 * 2. 当从 state 中获得了新的 child，就把它加到本地 children 然后显示
 * 3. 当从 state 中的 children 比本地的少，则找出少的 child，先设置其 open=false，过 1 秒再把它从本地 children 中移除，确保 child 的关闭动画可以执行完
 */
export const ModalContainer: React.FC = React.memo(() => {
    // 获取当前所有 Modal（来自 state）
    const stateModels = useUiModels();

    // 本地缓存的 children
    const [localChildren, setLocalChildren] = useState<ModalChild[]>([]);

    // 使用 ref 追踪待删除的定时器
    const removeTimersRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

    /**
     * 监听 state 中的 models 变化，更新本地 children
     */
    useEffect(() => {
        // 获取 state 中的 Modal IDs
        const stateIds = new Set(stateModels.map(m => m.id).filter(Boolean) as string[]);

        // 获取本地 children 中的 Modal IDs
        const localIds = new Set(localChildren.map(c => c.model.id).filter(Boolean) as string[]);

        // 1. 找出新增的 Modal（在 state 中有，但本地没有）
        const addedIds: string[] = [];
        stateIds.forEach(id => {
            if (!localIds.has(id)) {
                addedIds.push(id);
            }
        });

        // 2. 找出删除的 Modal（本地有，但 state 中没有）
        const removedIds: string[] = [];
        localIds.forEach(id => {
            if (!stateIds.has(id)) {
                removedIds.push(id);
            }
        });

        // 3. 处理新增的 Modal
        if (addedIds.length > 0) {
            const newChildren: ModalChild[] = [];

            addedIds.forEach(id => {
                const model = stateModels.find(m => m.id === id);
                if (model && model.partKey) {
                    const ComponentType = getScreenPartComponentType(model.partKey);
                    if (ComponentType) {
                        newChildren.push({
                            ComponentType,
                            model,
                        });
                    }
                }
            });

            if (newChildren.length > 0) {
                newChildren.forEach(child=>{
                    logger.log([moduleName,LOG_TAGS.UI],`添加modal窗口: ${child.model.partKey}`)
                })

                setLocalChildren(prev => [...prev, ...newChildren]);
            }
        }

        // 4. 处理删除的 Modal
        if (removedIds.length > 0) {
            // 先设置 open=false，触发关闭动画
            setLocalChildren(prev =>
                prev.map(child => {
                    if (removedIds.includes(child.model.id as string)) {
                        logger.log([moduleName,LOG_TAGS.UI],`关闭modal窗口: ${child.model.partKey}`)
                        return {
                            ...child,
                            model: {
                                ...child.model,
                                open: false,
                            },
                        };
                    }
                    return child;
                })
            );

            // 1 秒后从本地 children 中移除
            removedIds.forEach(id => {
                // 清除之前的定时器（如果有）
                const existingTimer = removeTimersRef.current.get(id);
                if (existingTimer) {
                    clearTimeout(existingTimer);
                }

                // 设置新的定时器
                const timer = setTimeout(() => {
                    setLocalChildren(prev =>
                        prev.filter(child => child.model.id !== id)
                    );
                    removeTimersRef.current.delete(id);
                }, 1000);

                removeTimersRef.current.set(id, timer);
            });
        }
    }, [stateModels]);

    /**
     * 组件卸载时清理定时器
     */
    useEffect(() => {
        return () => {
            // 清理所有定时器
            removeTimersRef.current.forEach(timer => clearTimeout(timer));
            removeTimersRef.current.clear();
        };
    }, []);

    /**
     * 渲染 Modal 列表
     */
    if (localChildren.length === 0) {
        return null;
    }

    return (
        <>
            {localChildren.map((child) => {
                const {ComponentType, model} = child;
                const key = model.id || model.partKey;

                if (!key) {
                    return null;
                }

                return <ComponentType key={key} {...model} />;
            })}
        </>
    );
});
