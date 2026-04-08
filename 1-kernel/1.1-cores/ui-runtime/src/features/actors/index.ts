import {moduleName} from "../../moduleName";
import {createActors} from "@impos2/kernel-core-base";
import {InitializeActor} from "./initialize";
import {ScreenActor} from "./screen";
import {OverlayActor} from "./overlay";
import {UiVariableActor} from "./uiVariable";

export const kernelCoreUiRuntimeActors = createActors(moduleName, {
    initializeActor: InitializeActor,
    screenActor: ScreenActor,
    overlayActor: OverlayActor,
    uiVariableActor: UiVariableActor
});
