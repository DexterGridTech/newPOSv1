import {registerStateToPersist, registerStateToSync} from "@impos2/kernel-base";
import {createSlice, PayloadAction} from "@reduxjs/toolkit";
import {User} from "../../types";


export interface UserInfoState {
    user?:User|null
}

export const initialState:UserInfoState = {
    user:null
}

export const userInfoSlice = createSlice({
    name: 'userInfo',
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

registerStateToPersist(userInfoSlice.name)
registerStateToSync(userInfoSlice.name)
