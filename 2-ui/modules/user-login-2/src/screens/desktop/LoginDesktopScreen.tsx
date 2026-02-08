import React from 'react';
// 直接从具体文件导入,避免循环依赖
import {useUserLogin} from '../../hooks/useUserLogin';
import {LoginForm} from '../../components/LoginForm/LoginForm';
import {
    currentState,
    instanceInfoSlice,
    InstanceMode,
    logger,
    LOG_TAGS,
    RootState,
    ScreenMode
} from "@impos2/kernel-base";
import {ScreenPartRegistration} from "@impos2/kernel-module-ui-navigation";
import {userInfoSlice} from "@impos2/kernel-module-user";
import {moduleName} from "../../moduleName";

// 诊断：打印导入的函数和组件
console.log('🔍 useUserLogin 函数:', useUserLogin);
const hookCode = useUserLogin.toString();
console.log('🔍 Hook 代码长度:', hookCode.length);
console.log('🔍 LoginForm 组件:', LoginForm);

export const LoginDesktopScreen: React.FC = () => {
    console.log('🟣 user-login-2: LoginDesktopScreen 组件被渲染');

    const {
        userId,
        password,
        loginStatus,
        handleUserIdChange,
        handlePasswordChange,
        handleSubmit,
    } = useUserLogin();

    return (
        <LoginForm
            userId={userId}
            password={password}
            loginStatus={loginStatus}
            onUserIdChange={handleUserIdChange}
            onPasswordChange={handlePasswordChange}
            onSubmit={handleSubmit}
        />
    );
};

export const loginDesktopScreenPart: ScreenPartRegistration = {
    name: 'loginDesktopScreen',
    title: '用户登录',
    description: '用户登录页面（桌面版）',
    partKey: 'login',
    containerKey: 'screen.container.root',
    screenMode: [ScreenMode.DESKTOP],
    componentType: LoginDesktopScreen,
    indexInContainer: 10,
    readyToEnter: () => {
        console.log('🟡 user-login-2: readyToEnter 被调用');
        const state = currentState<RootState>()
        console.log('🟡 instanceMode:', state[instanceInfoSlice.name].instance.instanceMode);
        console.log('🟡 user:', state[userInfoSlice.name].user);

        if(state[instanceInfoSlice.name].instance.instanceMode !== InstanceMode.MASTER){
            logger.debug([moduleName, LOG_TAGS.System, 'LoginDesktopScreen'], "非master设备，不能进入LoginDesktopScreen");
            console.log('🟡 user-login-2: readyToEnter 返回 false (非master)');
            return false;
        }
        if (state[userInfoSlice.name].user) {
            logger.debug([moduleName, LOG_TAGS.System, 'LoginDesktopScreen'], "用户已登录，不能进入LoginDesktopScreen");
            console.log('🟡 user-login-2: readyToEnter 返回 false (已登录)');
            return false;
        }
        console.log('🟡 user-login-2: readyToEnter 返回 true');
        return true;
    }
}
