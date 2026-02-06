import {useCallback, useState} from 'react';
import {logger, LOG_TAGS, useRequestStatus} from "@impos2/kernel-base";
import {useEditableUiVariable} from "@impos2/kernel-module-ui-navigation";
import {userLoginVariable} from "../variables";
import {nanoid} from "@reduxjs/toolkit";
import { UserPasswordLoginCommand} from "@impos2/kernel-module-user";

const moduleName = 'user-login-2';

// 用户登录Hook
export const useUserLogin = () => {

    const {value: userId, setValue: setUserId} = useEditableUiVariable({
        variable: userLoginVariable.userId,
        debounceMs: 300,
    });
    const {value: password, setValue: setPassword} = useEditableUiVariable({
        variable: userLoginVariable.password,
        debounceMs: 300,
    });

    const [requestId, setRequestId] = useState<string | null>(null);
    const newRequest=()=>{
        const random=nanoid(8)
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
        logger.log([moduleName, LOG_TAGS.System, 'useUserLogin'], '提交登录', { userId, password });

        new UserPasswordLoginCommand({userId: userId, password: password})
            .executeFromRequest( newRequest());
    }, [userId, password, loginStatus]);


    return {
        // 状态
        userId,
        password,
        loginStatus,
        // 方法
        handleUserIdChange,
        handlePasswordChange,
        handleSubmit,
    };
};
