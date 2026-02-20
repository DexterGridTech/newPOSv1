import {moduleName} from "../../moduleName";
import {createActors} from "@impos2/kernel-core-base";
import {InitializeActor} from "./initialize";
import {TerminalActor} from "./terminal";


export const kernelTerminalActors = createActors(moduleName, {
    initializeActor: InitializeActor,
    terminalActor: TerminalActor
});
