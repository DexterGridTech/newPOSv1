import {User} from "../types";
import {storeEntry} from "@impos2/kernel-core-base";
import {kernelMixcUserState} from "../types/shared/moduleStateKey";


export const getUser = (): User|undefined => {
    return storeEntry.getStateByKey(kernelMixcUserState.user).user?.value
}


