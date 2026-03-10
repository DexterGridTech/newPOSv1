import React, {useCallback} from 'react';
import {ActivateForm} from '../components';
import {uiBaseCoreUiVariables, useLifecycle} from "@impos2/ui-core-base";
import {ScreenMode, ScreenPartRegistration} from "@impos2/kernel-core-base";
import {InstanceMode, Workspace} from "@impos2/kernel-core-interconnection";
import {getTerminal} from "@impos2/kernel-core-terminal";

export const MPActivateDeviceScreen: React.FC = () => {
    useLifecycle({
        componentName: 'MPActivateDeviceScreen',
        onInitiated: useCallback(() => {
        }, []),
        onClearance: useCallback(() => {
        }, []),
    });

    return (
        <ActivateForm/>
    );
};

export const mpActivateDeviceScreenPart: ScreenPartRegistration = {
    name: 'mpActivateDeviceScreen',
    title: '设备激活',
    description: '设备激活页面（桌面/移动版）',
    partKey: 'activate-master-primary',
    containerKey: uiBaseCoreUiVariables.primaryRootContainer.key,
    screenMode: [ScreenMode.DESKTOP,ScreenMode.MOBILE],
    workspace:[Workspace.MAIN],
    instanceMode:[InstanceMode.MASTER],
    componentType: MPActivateDeviceScreen,
    indexInContainer: 1,
    readyToEnter:()=>{
        const terminal=getTerminal();
        return !terminal;
    }
}
