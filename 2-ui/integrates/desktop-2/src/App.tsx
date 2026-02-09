import React from 'react';
import {desktopVariables} from "./ui/desktopVariables";
import {LongPressCommand, ModalContainer, StackContainer, useLongPress} from "@impos2/ui-core-base-2";
import {View} from "react-native";

export const App: React.FC = () => {
    const longPressHandlers = useLongPress({
        onLongPress: () => {
            new LongPressCommand("primary-container").executeInternally();
        },
        delay: 2000
    });
    return (
        <View style={{flex: 1}}>
            <View  {...longPressHandlers} style={{flex: 1}}>
                <StackContainer containerPart={desktopVariables.rootScreenContainer}>
                </StackContainer>
            </View>
            <ModalContainer/>
        </View>
    );
};
