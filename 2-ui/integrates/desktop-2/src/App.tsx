import React from 'react';
import {desktopVariables} from "./variables/desktopVariables";
import {ModalContainer, StackContainer} from "@impos2/ui-core-base-2";
import {View} from "react-native";
import {useLongPress} from "./hooks";

export const App: React.FC = () => {
    const longPressHandlers = useLongPress({
        onLongPress: () => {
            console.log('primary-container 长按2秒触发');
        },
        delay: 2000
    });
    return (
        <View
            style={{flex: 1}}
            key="primary-container"
            {...longPressHandlers}
        >
            <StackContainer
                containerPart={desktopVariables.rootScreenContainer}
            >
            </StackContainer>
            <ModalContainer/>
        </View>
    );
};
