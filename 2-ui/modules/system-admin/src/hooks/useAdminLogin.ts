import {useCallback, useEffect, useState} from 'react';
import {ClearUiVariablesCommand, useRequestStatus} from "@impos2/kernel-base";
import {CloseModalCommand, useEditableUiVariable} from "@impos2/kernel-base";
import {nanoid} from "@reduxjs/toolkit";
import {AdminLoginCommand} from "../features/commands";
import {systemAdminVariable} from "../ui/systemAdminVariables";

export const useAdminLogin = (config: { modalId: string }) => {
    const {
        modalId,
    } = config;

    const [requestId, setRequestId] = useState<string | null>(null);
    const newRequest = () => {
        const random = nanoid(8)
        setRequestId(random)
        return random
    }

    // 使用 UI 变量 Hook 管理密码
    const {value: password, setValue: setPassword} = useEditableUiVariable({
        variable: systemAdminVariable.adminPassword,
    });

    const loginStatus = useRequestStatus(requestId);


    /**
     * 关闭弹窗
     */
    const handleClose = useCallback(() => {
        setPassword('')
        new CloseModalCommand({modelId: modalId}).executeInternally();
    }, [modalId, setPassword]);

    /**
     * 监听登录状态，成功后关闭弹窗
     */
    useEffect(() => {
        if (loginStatus?.status === 'complete' && modalId) {
            // 关闭弹窗
            handleClose();
        }
    }, [loginStatus?.status, modalId, handleClose]);

    /**
     * 处理密码变更
     */
    const handlePasswordChange = useCallback(
        (value: string) => {
            setPassword(value);
            newRequest()
        },
        [setPassword]
    );

    /**
     * 提交登录
     */
    const handleSubmit = useCallback(
        () => {
            if (loginStatus?.status === 'started')
                return;
            new AdminLoginCommand({adminPassword: password})
                .executeFromRequest(newRequest());
        },
        [loginStatus, password]
    );
    const cleanup=useCallback(
        ()=>{
            new ClearUiVariablesCommand({uiVariableKeys: [systemAdminVariable.adminPassword.key]})
        },
        [setPassword]
    )

    return {
        // 状态
        password,
        loginStatus,
        // 方法
        handlePasswordChange,
        handleSubmit,
        handleClose,
        cleanup
    };
};
