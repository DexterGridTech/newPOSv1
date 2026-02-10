import {useCallback, useState} from 'react';
import {ClearUiVariablesCommand, LOG_TAGS, logger, useEditableUiVariable, useRequestStatus} from "@impos2/kernel-base";
import {nanoid} from "@reduxjs/toolkit";
import {UserPasswordLoginCommand} from "@impos2/kernel-module-user";
import {moduleName} from "../moduleName";
import {userLoginVariable} from "../ui/userLoginVariables";

// 用户登录Hook
export const useUserLogin = () => {

    const {value: userId, setValue: setUserId} = useEditableUiVariable(userLoginVariable.userId);
    const {value: password, setValue: setPassword} = useEditableUiVariable(userLoginVariable.password);

    const [requestId, setRequestId] = useState<string | null>(null);
    const newRequest = () => {
        const random = nanoid(8)
        setRequestId(random)
        return random
    }
    const loginStatus = useRequestStatus(requestId);


    // 更新用户名
    const handleUserIdChange = useCallback(
        (value: string) => {
            setUserId(value);
            newRequest()
        },
        [setUserId]
    );

    // 更新密码
    const handlePasswordChange = useCallback(
        (value: string) => {
            setPassword(value);
            newRequest()
        },
        [setPassword]
    );

    // 提交登录
    const handleSubmit = useCallback(async () => {
        if (loginStatus?.status === 'started')
            return;
        logger.log([moduleName, LOG_TAGS.System, 'useUserLogin'], '提交登录', {userId, password});

        new UserPasswordLoginCommand({userId: userId, password: password})
            .executeFromRequest(newRequest());
    }, [userId, password, loginStatus]);


    const cleanup = useCallback(
        () => {

            new ClearUiVariablesCommand({
                uiVariableKeys: [
                    userLoginVariable.userId.key,
                    userLoginVariable.password.key,
                ]
            })
        },
        [setUserId, setPassword]
    )

    return {
        // 状态
        userId,
        password,
        loginStatus,
        // 方法
        handleUserIdChange,
        handlePasswordChange,
        handleSubmit,
        cleanup
    };
};
