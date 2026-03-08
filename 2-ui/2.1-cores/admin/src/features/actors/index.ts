import {moduleName} from "../../moduleName";
import {createActors} from "@impos2/kernel-core-base";
import {InitializeActor} from "./initialize";
import {AdminActor} from "./admin";


export const uiCoreAdminActors = createActors(moduleName, {
    initializeActor: InitializeActor,
    adminActor:AdminActor
});
