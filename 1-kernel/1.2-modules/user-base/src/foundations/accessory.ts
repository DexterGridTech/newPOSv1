import {User} from "../types";
import {storeEntry} from "@impos2/kernel-core-base";
import {kernelUserBaseState} from "../types/shared/moduleStateKey";


export const getUser = (): User|undefined => {
    return storeEntry.getStateByKey(kernelUserBaseState.user).user?.value
}


