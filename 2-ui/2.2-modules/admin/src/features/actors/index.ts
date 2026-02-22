import {moduleName} from "../../moduleName";
import {createActors} from "@impos2/kernel-core-base";
import {InitializeActor} from "./initialize";


export const uiAdminActors = createActors(moduleName, {
    initializeActor: InitializeActor,
});
