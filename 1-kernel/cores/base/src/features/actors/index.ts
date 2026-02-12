import {moduleName} from "../../moduleName";
import {InitActor} from "./init";
import {createActors} from "../../foundations";


export const kernelCoreBaseActors = createActors(moduleName, {
    initActor: InitActor
});
