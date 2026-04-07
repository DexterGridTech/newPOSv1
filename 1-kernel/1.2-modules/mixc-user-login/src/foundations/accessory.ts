import {User} from "../types";
import {storeEntry} from "@impos2/kernel-core-base";
import {kernelMixcUserLoginState} from "../types/shared/moduleStateKey";


export const getUser = (): User|undefined => {
    return storeEntry.getStateByKey(kernelMixcUserLoginState.user).user?.value
}


