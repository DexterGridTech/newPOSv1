import {useCallback, useState} from 'react';
import {
    ActivateDeviceCommand,
    ClearUiVariablesCommand,
    useEditableUiVariable,
    useRequestStatus
} from "@impos2/kernel-base";
import {nanoid} from "@reduxjs/toolkit";
import {deviceActivateVariable} from "../ui/deviceActivateVariables";

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

    const cleanup = useCallback(
        () => {
            new ClearUiVariablesCommand({uiVariableKeys: [deviceActivateVariable.activationCode.key]})
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
