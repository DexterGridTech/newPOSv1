import React, {useCallback} from 'react';
import {LoginForm} from '../components/LoginForm';
import {uiBaseCoreUiVariables, useLifecycle} from "@impos2/ui-core-base";
import {ScreenMode, ScreenPartRegistration} from "@impos2/kernel-core-base";
import {InstanceMode, Workspace} from "@impos2/kernel-core-interconnection";
import {getUser} from "@impos2/kernel-mixc-user";

export const MPLoginScreen: React.FC = () => {
    useLifecycle({
        componentName: 'MPLoginScreen',
        onInitiated: useCallback(() => {
        }, []),
        onClearance: useCallback(() => {
        }, []),
    });

    return (
        <LoginForm/>
    );
};

export const mpLoginScreenPart: ScreenPartRegistration = {
    name: 'mpLoginScreen',
    title: '登录页',
    description: '登录页（桌面/移动版）',
    partKey: 'login-master-primary',
    containerKey: uiBaseCoreUiVariables.primaryRootContainer.key,
    screenMode: [ScreenMode.DESKTOP, ScreenMode.MOBILE],
    workspace: [Workspace.MAIN],
    instanceMode: [InstanceMode.MASTER],
    componentType: MPLoginScreen,
    indexInContainer: 2,
    readyToEnter:()=>{
        const user=getUser()
        return !user
    }
}
