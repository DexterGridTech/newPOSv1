import {storeEntry} from "@impos2/kernel-core-base";
import {kernelCoreTerminalState} from "../types/shared/moduleStateKey";

export const kernelTokenGetter = {
    get: () => {
        const terminal = storeEntry.getStateByKey(kernelCoreTerminalState.terminal)
        return terminal.token?.value
    }
}