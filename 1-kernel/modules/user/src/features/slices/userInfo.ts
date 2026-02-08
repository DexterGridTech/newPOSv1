import {registerStateToPersist, registerStateToSync} from "@impos2/kernel-base";
import {createSlice, PayloadAction} from "@reduxjs/toolkit";
import {User} from "../../types";
import {KernelUserStateNames} from "../../types/stateNames";
import {UserInfoState} from "../../types/state";

export type {UserInfoState}

export const initialState:UserInfoState = {
    user:null
}

export const userInfoSlice = createSlice({
    name: KernelUserStateNames.userInfo,
    initialState,
    reducers: {
        setUser: (state, action: PayloadAction<User>) => {
            state.user = action.payload
        },
        clearUser: (state, action: PayloadAction<void>) => {
            state.user = null
        }
    }
})

export const userInfoActions = userInfoSlice.actions

registerStateToPersist(KernelUserStateNames.userInfo)
registerStateToSync(KernelUserStateNames.userInfo)
