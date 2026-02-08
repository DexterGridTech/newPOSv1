import {useCallback, useEffect, useState} from 'react';
import {useRequestStatus} from "@impos2/kernel-base";
import {CloseModalCommand, useEditableUiVariable} from "@impos2/kernel-module-ui-navigation";
import {nanoid} from "@reduxjs/toolkit";
import {systemAdminVariable} from "../ui-variables";
import {AdminLoginCommand} from "../features";

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
        debounceMs: 300
    });

    const loginStatus = useRequestStatus(requestId);

    /**
     * 组件生命周期管理
     */
    useEffect(() => {
        // 组件挂载
        return () => {
            // 组件卸载
        };
    }, []); // 空依赖数组，只在挂载和卸载时执行

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

    return {
        // 状态
        password,
        loginStatus,
        // 方法
        handlePasswordChange,
        handleSubmit,
        handleClose,
    };
};
