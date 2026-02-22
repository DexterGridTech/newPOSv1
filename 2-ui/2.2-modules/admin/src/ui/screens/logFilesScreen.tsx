import React from "react";
import {View} from "react-native";
import {ScreenMode, ScreenPartRegistration} from "@impos2/kernel-core-base";
import {uiAdminVariables} from "../variables";
import {InstanceMode, Workspace} from "@impos2/kernel-core-interconnection";

export const LogFilesScreen: React.FC = () => {

    return (
        <View></View>
    )
}

export const logFilesScreenPart: ScreenPartRegistration = {
    name: 'logFilesScreenPart',
    title: '日志文件',
    description: '当前系统日志文件',
    partKey: 'system.admin.log.files',
    containerKey: uiAdminVariables.systemAdminPanel.key,
    screenMode: [ScreenMode.DESKTOP, ScreenMode.MOBILE],
    instanceMode: [InstanceMode.MASTER],
    workspace: [Workspace.MAIN],
    componentType: LogFilesScreen,
    indexInContainer: 0,
};
