import React, {useCallback} from 'react';
import {LoginForm} from '../components/LoginForm';
import {uiBaseCoreUiVariables, useLifecycle} from "@impos2/ui-core-base";
import {ScreenMode, ScreenPartRegistration} from "@impos2/kernel-core-base";
import {InstanceMode, Workspace} from "@impos2/kernel-core-interconnection";
import {getUser} from "@impos2/kernel-mixc-user";

export const LoginScreen: React.FC = () => {
    useLifecycle({
        componentName: 'LoginScreen',
        onInitiated: useCallback(() => {
        }, []),
        onClearance: useCallback(() => {
        }, []),
    });

    return (
        <LoginForm/>
    );
};

export const loginScreenPart: ScreenPartRegistration = {
    name: 'loginScreen',
    title: '登录页',
    description: '登录页（桌面/移动版）',
    partKey: 'login',
    containerKey: uiBaseCoreUiVariables.primaryRootContainer.key,
    screenMode: [ScreenMode.DESKTOP, ScreenMode.MOBILE],
    workspace: [Workspace.MAIN],
    instanceMode: [InstanceMode.MASTER],
    componentType: LoginScreen,
    indexInContainer: 2,
    readyToEnter:()=>{
        const user=getUser()
        return !user
    }
}
