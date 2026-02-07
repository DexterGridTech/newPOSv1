import React from "react";
import {EmptyScreen, LongPressCommand, ModalContainer, StackContainer, useLongPress} from "@impos2/ui-core-base-2";
import {View} from "react-native";
import {registerUIVariable} from "@impos2/kernel-module-ui-navigation";

export const TestScreen: React.FC = () => {
    const longPressHandlers = useLongPress({
        onLongPress: () => {
            new LongPressCommand("primary-container").executeInternally();
        },
        delay: 500
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
    rootScreenContainer: registerUIVariable({key: 'screen.container.root', defaultValue: EmptyScreen})
}