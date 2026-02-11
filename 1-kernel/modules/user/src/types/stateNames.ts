import {UserInfoState} from "./state";
import {currentState, RootState} from "@impos2/kernel-base";

export const KernelUserStateNames = {
    userInfo: 'userInfo' as const,
} as const

export type KernelUserStateMap = {
    [KernelUserStateNames.userInfo]: UserInfoState;
}

//todo 这个代码怎么写？
const getState = <K extends keyof RootState>(
    stateName: K
): RootState[K] => {
    const rootState = currentState<RootState>();
    return rootState[stateName];
}



const userInfoState=getState(KernelUserStateNames.userInfo)
console.log(userInfoState.user)
