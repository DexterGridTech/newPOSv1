import React from "react";
import {moduleName} from "../../moduleName";
import {getScreenPartComponentType, ModalScreen, useUiModels} from "@impos2/kernel-core-navigation";
import {LOG_TAGS, logger} from "@impos2/kernel-core-base";

/**
 * ModalContainer 组件
 *
 * 简化逻辑：
 * 1. 直接从 state 获取 modals 并渲染
 * 2. state 变化立即响应，无延迟
 * 3. 无本地缓存，无关闭动画
 */
export const ModalContainer: React.FC = React.memo(() => {
    const stateModels = useUiModels();

    if (!stateModels || stateModels.length === 0) {
        return null;
    }

    return (
        <>
            {stateModels.map((modal) => {
                if (!modal.id || !modal.screenPartKey) {
                    return null;
                }

                const ComponentType = getScreenPartComponentType(modal.screenPartKey);
                if (!ComponentType) {
                    logger.error([moduleName, LOG_TAGS.UI], `找不到组件: ${modal.screenPartKey}`);
                    return null;
                }

                return <ComponentType key={modal.id} {...modal} />;
            })}
        </>
    );
});
