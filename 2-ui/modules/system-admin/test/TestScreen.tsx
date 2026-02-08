import React from "react";
import {LongPressCommand, ModalContainer, StackContainer, useLongPress} from "@impos2/ui-core-base-2";
import {View} from "react-native";
import {registerUIVariable, ScreenMode} from "@impos2/kernel-base";

export const TestScreen: React.FC = () => {
    const longPressHandlers = useLongPress({
        onLongPress: () => {
            new LongPressCommand("primary-container").executeInternally();
        },
        delay: 2000
    });
    return (
        <View style={{flex: 1}}>
            <View  {...longPressHandlers} style={{flex: 1}}>
                <StackContainer containerPart={testVariables.rootScreenContainer}>
                </StackContainer>
            </View>
            <ModalContainer/>
        </View>
    );
};
export const testVariables = {
    rootScreenContainer: registerUIVariable({
        key: 'screen.container.root',
        defaultValue: {
            name: 'emptyScreen',
            title: '空白页面',
            description: '默认的空白页面组件',
            partKey: 'empty',
            screenMode: [ScreenMode.DESKTOP, ScreenMode.MOBILE]
        }
    })
}