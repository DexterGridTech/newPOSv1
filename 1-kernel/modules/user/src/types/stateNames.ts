import {UserInfoState} from "./state";

export const KernelUserStateNames = {
    userInfo: 'userInfo' as const,
} as const

export type KernelUserStateMap = {
    [KernelUserStateNames.userInfo]: UserInfoState;
}