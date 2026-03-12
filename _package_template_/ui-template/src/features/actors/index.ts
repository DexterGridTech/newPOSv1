import {moduleName} from "../../moduleName";
import {createActors} from "@impos2/kernel-core-base";
import {InitializeActor} from "./initialize";


export const ui{{PACKAGE_NAME_PASCAL}}Actors = createActors(moduleName, {
    initializeActor: InitializeActor,
});
