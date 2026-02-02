import {
    getScreenPartComponentType,
    ScreenPart,
    UIVariable,
    useChildScreenPart
} from "@impos2/kernel-module-ui-navigation";
import React from "react";
import {EmptyScreen} from "./emptyScreen";
import {logger} from "@impos2/kernel-base";

export interface StackContainerProps {
    containerPart: UIVariable<ScreenPart>
}

export const StackContainer: React.FC<StackContainerProps> = (
    {
        containerPart
    }) => {

    const child = useChildScreenPart(containerPart)

    const ComponentType = getScreenPartComponentType(child.partKey) ?? EmptyScreen

    if (ComponentType === EmptyScreen) {
        logger.error(`StackContainer : Component type not found for screen part '${child.partKey}'`)
    }

    return <ComponentType {...child.props}/>
};