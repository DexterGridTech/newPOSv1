import React, {useCallback} from 'react';
import {ActivateForm} from '../components';
import {uiBaseCoreUiVariables, useLifecycle} from "@impos2/ui-core-base";
import {ScreenMode, ScreenPartRegistration} from "@impos2/kernel-core-base";
import {InstanceMode, Workspace} from "@impos2/kernel-core-interconnection";

export const ActivateDeviceScreen: React.FC = () => {
    useLifecycle({
        componentName: 'ActivateDeviceScreen',
        onInitiated: useCallback(() => {
        }, []),
        onClearance: useCallback(() => {
        }, []),
    });

    return (
        <ActivateForm/>
    );
};

export const activateDeviceScreenPart: ScreenPartRegistration = {
    name: 'activateDeviceScreen',
    title: '设备激活',
    description: '设备激活页面（桌面/移动版）',
    partKey: 'activate',
    containerKey: uiBaseCoreUiVariables.rootScreenContainer.key,
    screenMode: [ScreenMode.DESKTOP,ScreenMode.MOBILE],
    workspace:[Workspace.MAIN],
    instanceMode:[InstanceMode.MASTER],
    componentType: ActivateDeviceScreen,
    indexInContainer: 1,
}
