import React, {useEffect, useRef, useState} from "react";
import {moduleName} from "../../moduleName";
import {getScreenPartComponentType, ModalScreen, useUiModels} from "@impos2/kernel-core-navigation";
import {LOG_TAGS, logger} from "@impos2/kernel-core-base";

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
        const stateIds = new Set(stateModels.map(m => m.id).filter(Boolean) as string[]);

        setLocalChildren(prev => {
            const localIds = new Set(prev.map(c => c.model.id).filter(Boolean) as string[]);

            // 新增
            const newChildren: ModalChild[] = [];
            stateIds.forEach(id => {
                if (!localIds.has(id)) {
                    const model = stateModels.find(m => m.id === id);
                    if (model?.screenPartKey) {
                        const ComponentType = getScreenPartComponentType(model.screenPartKey);
                        if (ComponentType) {
                            logger.log([moduleName, LOG_TAGS.UI], `添加modal窗口: ${model.screenPartKey}`);
                            newChildren.push({ComponentType, model});
                        }
                    }
                }
            });

            // 关闭动画
            const removedIds: string[] = [];
            localIds.forEach(id => {
                if (!stateIds.has(id)) removedIds.push(id);
            });

            let next = prev;
            if (removedIds.length > 0) {
                next = prev.map(child => {
                    if (removedIds.includes(child.model.id as string)) {
                        logger.log([moduleName, LOG_TAGS.UI], `关闭modal窗口: ${child.model.screenPartKey}`);
                        return {...child, model: {...child.model, open: false}};
                    }
                    return child;
                });

                removedIds.forEach(id => {
                    const existingTimer = removeTimersRef.current.get(id);
                    if (existingTimer) clearTimeout(existingTimer);
                    const timer = setTimeout(() => {
                        setLocalChildren(p => p.filter(c => c.model.id !== id));
                        removeTimersRef.current.delete(id);
                    }, 1000);
                    removeTimersRef.current.set(id, timer);
                });
            }

            if (newChildren.length === 0 && removedIds.length === 0) return prev;
            return [...next, ...newChildren];
        });
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
                const key = model.id || model.screenPartKey;

                if (!key) {
                    return null;
                }

                return <ComponentType key={key} {...model} />;
            })}
        </>
    );
});
