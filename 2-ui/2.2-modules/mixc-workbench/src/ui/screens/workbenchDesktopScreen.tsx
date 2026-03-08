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
            <WorkbenchDesktopScreen/>
            <StackContainer containerPart={uiMixcWorkbenchVariables.workbenchMainContainer}>
            </StackContainer>
        </View>
    );
};

export const workbenchDesktopScreenPart: ScreenPartRegistration = {
    name: 'workbenchDesktopScreen',
    title: '操作台',
    description: '操作台页面（桌面版）',
    partKey: 'workbench',
    containerKey: uiBaseCoreUiVariables.rootScreenContainer.key,
    screenMode: [ScreenMode.DESKTOP],
    workspace: [Workspace.MAIN],
    instanceMode: [InstanceMode.MASTER],
    componentType: WorkbenchDesktopScreen,
    indexInContainer: 10,
}
