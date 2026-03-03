import {moduleName} from "../../moduleName";
import {InitializeActor} from "./initialize";
import {createActors} from "../../foundations";
import {ErrorMessagesActor} from "./errorMessages";
import {SystemParametersActor} from "./systemParameters";
import {AppControlActor} from "./appControl";


export const kernelCoreBaseActors = createActors(moduleName, {
    initializeActor: InitializeActor,
    errorMessagesActor: ErrorMessagesActor,
    systemParametersActor: SystemParametersActor,
    appControlActor:AppControlActor
});
