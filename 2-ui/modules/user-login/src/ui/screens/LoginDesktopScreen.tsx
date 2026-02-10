import React, {useCallback} from 'react';
// 直接从具体文件导入,避免循环依赖
import {LoginForm} from '../components';
import {
    currentState,
    instanceInfoSlice,
    InstanceMode,
    logger,
    LOG_TAGS,
    RootState,
    ScreenMode,
    KernelBaseStateNames,
} from "@impos2/kernel-base";
import {ScreenPartRegistration} from "@impos2/kernel-base";
import {userInfoSlice, KernelUserStateNames} from "@impos2/kernel-module-user";
import {moduleName} from "../../moduleName";
import {useLifecycle} from "@impos2/ui-core-base-2";

export const LoginDesktopScreen: React.FC = () => {
    useLifecycle({
        componentName: 'LoginDesktopScreen',
        onInitiated: useCallback(() => {
        }, []),
        onClearance: useCallback(() => {
        }, []),
    });
    return (
        <LoginForm/>
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
        const state = currentState<RootState>()
        if(state[KernelBaseStateNames.instanceInfo].instance.instanceMode !== InstanceMode.MASTER){
            logger.debug([moduleName, LOG_TAGS.System, 'LoginDesktopScreen'], "非master设备，不能进入LoginDesktopScreen");
            return false;
        }
        if (state[KernelUserStateNames.userInfo].user) {
            logger.debug([moduleName, LOG_TAGS.System, 'LoginDesktopScreen'], "用户已登录，不能进入LoginDesktopScreen");
            return false;
        }
        return true;
    }
}
