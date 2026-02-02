import React from "react";
import {getScreenPartComponentType, useUiModels} from "@impos2/kernel-module-ui-navigation";
import {EmptyScreen} from "./emptyScreen";
import {logger} from "@impos2/kernel-base";

export const ModalContainer: React.FC<any> = () => {

    const children =
        useUiModels()
            .map(modelScreen => {
                const model = modelScreen
                const ComponentType = getScreenPartComponentType(modelScreen.partKey) ?? EmptyScreen
                if (ComponentType === EmptyScreen) {
                    logger.error(`ModelContainer : Component type not found for screen part '${modelScreen.partKey}'`)
                }
                logger.log(`ModelContainer : show model '${ComponentType.name}'`)
                return {
                    ComponentType,
                    model
                }
            }).filter(child => child.ComponentType != EmptyScreen)

    return <>
        {
            children
                .map(child =>
                    <child.ComponentType key={child.model.id!} {...child.model}/>
                )
        }
    </>
};