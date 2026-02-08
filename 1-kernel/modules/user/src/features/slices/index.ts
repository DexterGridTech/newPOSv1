import {userInfoSlice} from "./userInfo";
import {KernelUserStateNames} from "../../types/stateNames";

export * from './userInfo'

export const userModuleReducers = {
    [KernelUserStateNames.userInfo]: userInfoSlice.reducer,
}