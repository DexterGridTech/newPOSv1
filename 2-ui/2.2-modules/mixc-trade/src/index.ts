import {moduleName} from "./moduleName";
import {uiMixcTradeSlice} from "./features/slices";
import {uiMixcTradeActors} from "./features/actors";
import {uiMixcTradeCommands} from "./features/commands";
import {uiMixcTradeModulePreSetup} from "./application/modulePreSetup";
import {uiMixcTradeErrorMessages} from "./supports/errors";
import {uiMixcTradeParameters} from "./supports/parameters";
import {uiMixcTradeEpics} from "./features/epics";
import {uiMixcTradeMiddlewares} from "./features/middlewares";
import {AppModule} from "@impos2/kernel-core-base";
import {kernelCoreNavigationModule} from "@impos2/kernel-core-navigation";
import {uiMixcTradeScreenParts} from "./ui";
import {kernelMixcProductModule} from "@impos2/kernel-mixc-product";
import {kernelMixcOrderBaseModule} from "@impos2/kernel-mixc-order-base";
import {uiMixcWorkbenchModule} from "@impos2/ui-mixc-workbench";
import {kernelMixcOrderCreateTraditionalModule} from "@impos2/kernel-mixc-order-create-traditional";
import {kernelMixcOrderPayModule} from "@impos2/kernel-mixc-order-pay";

export const uiMixcTradeModule: AppModule = {
    name: moduleName,
    version: '0.0.1',
    slices: uiMixcTradeSlice,
    middlewares: uiMixcTradeMiddlewares,
    epics: uiMixcTradeEpics,
    commands: uiMixcTradeCommands,
    actors: uiMixcTradeActors,
    errorMessages: uiMixcTradeErrorMessages,
    parameters: uiMixcTradeParameters,
    dependencies: [
        kernelCoreNavigationModule,
        kernelMixcProductModule,
        kernelMixcOrderBaseModule,
        kernelMixcOrderCreateTraditionalModule,
        kernelMixcOrderPayModule,
        uiMixcWorkbenchModule,
    ],
    modulePreSetup: uiMixcTradeModulePreSetup,
    screenParts:uiMixcTradeScreenParts
}


export * from "./types";
export * from "./foundations";
export * from "./supports";
export * from "./hooks";
export * from "./selectors";
export * from "./ui/moduleScreenParts";
export {uiMixcTradeSlice} from "./features/slices";
export {uiMixcTradeCommands} from "./features/commands";
export {uiMixcTradeErrorMessages} from "./supports/errors";
export {uiMixcTradeParameters} from "./supports/parameters";
export {uiMixcTradeApis} from "./supports";