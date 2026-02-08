import {useCallback, useEffect, useState} from 'react';
import {ActivateDeviceCommand, logger, LOG_TAGS, useRequestStatus} from "@impos2/kernel-base";
import {
    AlertCommand,
    AlertInfo, createAlert,
    createModelScreen,
    OpenModalCommand,
    useEditableUiVariable
} from "@impos2/kernel-base";
import {nanoid} from "@reduxjs/toolkit";
import {deviceActivateVariable} from "../ui-variables";
import {moduleName} from "../moduleName";
export const useDeviceActivate = () => {

    const [requestId, setRequestId] = useState<string | null>(null);
    const newRequest = () => {
        const random = nanoid(8)
        setRequestId(random)
        return random
    }
    // 使用 UI 变量 Hook 管理激活码
    const {value: activationCode, setValue: setActivationCode} = useEditableUiVariable({
        variable: deviceActivateVariable.activationCode
    });

    const activateStatus = useRequestStatus(requestId);

    /**
     * 处理激活码变更
     */
    const handleActivationCodeChange = useCallback(
        (value: string) => {
            setActivationCode(value);
            newRequest()
        },
        [setActivationCode]
    );

    // 提交激活
    const handleSubmit = useCallback(
        () => {
            if (activateStatus?.status === 'started')
                return;

            new ActivateDeviceCommand({activateCode: activationCode})
                .executeFromRequest(newRequest());
        },
        [activationCode, activateStatus]
    );

    const cleanup=useCallback(
        ()=>{
            setActivationCode("")
        },
        [setActivationCode]
    )

    return {
        // 状态
        activationCode,
        activateStatus,
        // 方法
        handleActivationCodeChange,
        handleSubmit,
        cleanup,
    };
};
