import React from 'react';
import {desktopVariables} from "./variables/desktopVariables";
import {ModalContainer, StackContainer} from "@impos2/ui-core-base-2";
import {View} from "react-native";

export const App: React.FC = () => {
    return (
        <View style={{flex: 1}}>
            <StackContainer
                containerPart={desktopVariables.rootScreenContainer}
            >
            </StackContainer>
            <ModalContainer/>
        </View>
    );
};
