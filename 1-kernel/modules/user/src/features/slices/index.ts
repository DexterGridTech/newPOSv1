import {userInfoSlice} from "./userInfo";

export * from './userInfo'

export const userModuleReducers = {
    [userInfoSlice.name]: userInfoSlice.reducer,
}