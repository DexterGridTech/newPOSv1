import {storeEntry} from "@impos2/kernel-core-base";
import {kernelTerminalState} from "../types/shared/moduleStateKey";

export const kernelTokenGetter = {
    get: () => {
        const terminal = storeEntry.getStateByKey(kernelTerminalState.terminal)
        return terminal.token?.value
    }
}