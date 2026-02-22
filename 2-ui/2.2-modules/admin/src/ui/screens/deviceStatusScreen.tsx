import React from "react";
import {View} from "react-native";
import {ScreenMode, ScreenPartRegistration} from "@impos2/kernel-core-base";
import {uiAdminVariables} from "../variables";
import {InstanceMode, Workspace} from "@impos2/kernel-core-interconnection";

export const DeviceStatusScreen: React.FC = () => {

    return (
        <View></View>
    )
}

export const deviceStatusScreenPart: ScreenPartRegistration = {
    name: 'deviceStatusScreenPart',
    title: '系统状态',
    description: '当前系统信息',
    partKey: 'system.admin.device.status',
    containerKey: uiAdminVariables.systemAdminPanel.key,
    screenMode: [ScreenMode.DESKTOP, ScreenMode.MOBILE],
    instanceMode: [InstanceMode.MASTER],
    workspace: [Workspace.MAIN],
    componentType: DeviceStatusScreen,
    indexInContainer: 0,
};
