import React from "react";
import {moduleName} from "../../moduleName";
import {getScreenPartComponentType, useUiOverlays} from "@impos2/kernel-core-ui-runtime";
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
    const overlays = useUiOverlays();

    if (!overlays || overlays.length === 0) {
        return null;
    }

    return (
        <>
            {overlays.map((overlay) => {
                if (!overlay.id || !overlay.screenPartKey) {
                    return null;
                }

                const ComponentType = getScreenPartComponentType(overlay.screenPartKey);
                if (!ComponentType) {
                    logger.error([moduleName, LOG_TAGS.UI], `找不到组件: ${overlay.screenPartKey}`);
                    return null;
                }

                return <ComponentType key={overlay.id} {...overlay} />;
            })}
        </>
    );
});
