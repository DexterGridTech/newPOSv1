import React, {useCallback} from 'react';
import {StackContainer, uiBaseCoreUiVariables, useLifecycle} from "@impos2/ui-core-base";
import {ScreenMode, ScreenPartRegistration} from "@impos2/kernel-core-base";
import {InstanceMode, Workspace} from "@impos2/kernel-core-interconnection";
import {WorkbenchTitle} from "../components/workbenchTitle";
import {View} from "react-native";
import {uiMixcWorkbenchVariables} from "../variables";

export const WorkbenchDesktopScreen: React.FC = () => {
    useLifecycle({
        componentName: 'WorkbenchDesktopScreen',
        onInitiated: useCallback(() => {
        }, []),
        onClearance: useCallback(() => {
        }, []),
    });

    return (
        <View>
            <WorkbenchTitle/>
            <StackContainer containerPart={uiMixcWorkbenchVariables.workbenchMainContainer}>
            </StackContainer>
        </View>
    );
};

export const mpWorkbenchDesktopScreenPart: ScreenPartRegistration = {
    name: 'mpWorkbenchDesktopScreen',
    title: '操作台',
    description: '操作台页面（桌面版）',
    partKey: 'workbench-master-primary',
    containerKey: uiBaseCoreUiVariables.primaryRootContainer.key,
    screenMode: [ScreenMode.DESKTOP],
    workspace: [Workspace.MAIN],
    instanceMode: [InstanceMode.MASTER],
    componentType: WorkbenchDesktopScreen,
    indexInContainer: 10,
}

export const spWorkbenchDesktopScreenPart: ScreenPartRegistration = {
    name: 'spWorkbenchDesktopScreen',
    title: '操作台（副屏）',
    description: '操作台页面（副屏）',
    partKey: 'workbench-slave-primary',
    containerKey: uiBaseCoreUiVariables.primaryRootContainer.key,
    screenMode: [ScreenMode.DESKTOP],
    workspace: [Workspace.BRANCH],
    instanceMode: [InstanceMode.SLAVE],
    componentType: WorkbenchDesktopScreen,
    indexInContainer: 10,
}
