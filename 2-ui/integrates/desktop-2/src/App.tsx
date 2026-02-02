import React from 'react';
import {desktopVariables} from "./variables/desktopVariables";
import {StackContainer,ModalContainer} from "@impos2/ui-core-base-2";

export const App: React.FC = () => {
    return <>
        <StackContainer
            containerPart={desktopVariables.rootScreenContainer}
        >
        </StackContainer>
        <ModalContainer/>
    </>;
};
