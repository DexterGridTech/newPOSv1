import React, {useCallback} from 'react';
import {ActivateForm} from '../components';
import {uiBaseCoreUiVariables, useLifecycle} from "@impos2/ui-core-base";
import {ScreenMode, ScreenPartRegistration} from "@impos2/kernel-core-base";
import {InstanceMode, Workspace} from "@impos2/kernel-core-interconnection";

export const ActivateDesktopScreen: React.FC = () => {
    useLifecycle({
        componentName: 'ActivateDesktopScreen',
        onInitiated: useCallback(() => {
        }, []),
        onClearance: useCallback(() => {
        }, []),
    });

    return (
        <ActivateForm/>
    );
};

export const activateDesktopScreenPart: ScreenPartRegistration = {
    name: 'activateDesktopScreen',
    title: '设备激活',
    description: '设备激活页面（桌面版）',
    partKey: 'activate',
    containerKey: uiBaseCoreUiVariables.rootScreenContainer.key,
    screenMode: [ScreenMode.DESKTOP],
    workspace:[Workspace.MAIN],
    instanceMode:[InstanceMode.MASTER],
    componentType: ActivateDesktopScreen,
    indexInContainer: 1,
}
