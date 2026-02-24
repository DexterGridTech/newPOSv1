import {moduleName} from "../../moduleName";
import {createActors} from "@impos2/kernel-core-base";
import {InitializeActor} from "./initialize";
import {TerminalActor} from "./terminal";
import {UnitDataActor} from "./unitData";
import {TerminalConnectionActor} from "./terminalConnection";


export const kernelTerminalActors = createActors(moduleName, {
    initializeActor: InitializeActor,
    terminalActor: TerminalActor,
    unitDataActor:UnitDataActor,
    terminalConnectionActor:TerminalConnectionActor
});
