import React, {useCallback} from 'react';
import {StackContainer, uiBaseCoreUiVariables, useLifecycle} from "@impos2/ui-core-base";
import {ScreenMode, ScreenPartRegistration} from "@impos2/kernel-core-base";
import {InstanceMode, Workspace} from "@impos2/kernel-core-interconnection";
import {Text, View} from "react-native";

export const LoginScreen: React.FC = () => {
    useLifecycle({
        componentName: 'LoginScreen',
        onInitiated: useCallback(() => {
        }, []),
        onClearance: useCallback(() => {
        }, []),
    });

    return (
        <View>
            <Text>Login</Text>
        </View>
    );
};

export const loginScreenPart: ScreenPartRegistration = {
    name: 'loginScreen',
    title: '登录页',
    description: '登录页（桌面/移动版）',
    partKey: 'login',
    containerKey: uiBaseCoreUiVariables.rootScreenContainer.key,
    screenMode: [ScreenMode.DESKTOP, ScreenMode.MOBILE],
    workspace: [Workspace.MAIN],
    instanceMode: [InstanceMode.MASTER],
    componentType: LoginScreen,
    indexInContainer: 2,
}
