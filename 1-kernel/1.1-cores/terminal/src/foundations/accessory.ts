import {storeEntry} from "@impos2/kernel-core-base";
import {kernelCoreTerminalState, Unit} from "../types";

export const getTerminal = (): Unit|undefined => {
    return storeEntry.getStateByKey(kernelCoreTerminalState.terminal).terminal?.value
}