import React from 'react';
import {Text, View} from 'react-native';
import {ScreenPartRegistration} from "@impos2/kernel-module-ui-navigation";
import {ScreenMode} from "@impos2/kernel-base";

export const EmptyScreen: React.FC = () => {
    return (
        <View>
            <View style={{width: '100%', maxWidth: 400, padding: 24}}>
                <Text>系统错误，此页面无内容</Text>
            </View>
        </View>
    );
};
export const emptyScreenPart: ScreenPartRegistration = {
    partKey: 'empty',
    screenMode: [ScreenMode.DESKTOP, ScreenMode.MOBILE],
    componentType: EmptyScreen
}