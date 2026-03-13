import {useCallback} from "react";
import {kernelCoreNavigationCommands} from "@impos2/kernel-core-navigation";
import {kernelCoreInterconnectionCommands} from "@impos2/kernel-core-interconnection";

type DisplayType = 'primary' | 'secondary';

export const useDisplaySwitchConfirm = (config: {
    modalId: string;
    displayType: DisplayType;
}) => {
    const {modalId, displayType} = config;

    // 关闭 modal
    const closeModal = useCallback(() => {
        kernelCoreNavigationCommands.closeModal({modalId}).executeInternally();
    }, [modalId]);

    // 确认切换
    const handleConfirm = useCallback(() => {
        // 先关闭 modal
        closeModal();

        // 延迟执行切换命令,确保 modal 完全关闭
        setTimeout(() => {
            if (displayType === 'primary') {
                kernelCoreInterconnectionCommands.setDisplayToPrimary().executeInternally();
            } else {
                kernelCoreInterconnectionCommands.setDisplayToSecondary().executeInternally();
            }
        }, 200);
    }, [displayType, closeModal]);

    // 取消切换
    const handleCancel = useCallback(() => {
        closeModal();
    }, [closeModal]);

    // 清理资源
    const cleanup = useCallback(() => {
        // 预留清理逻辑
    }, []);

    return {
        handleConfirm,
        handleCancel,
        cleanup,
    };
};
