import {createSlice, PayloadAction} from "@reduxjs/toolkit";
import { kernelMixcUserLoginState} from "../../types/shared/moduleStateKey";
import {
    batchUpdateState,
    ModuleSliceConfig,
} from "@impos2/kernel-core-base";
import {SyncType} from "@impos2/kernel-core-interconnection";
import {User, UserState} from "../../types";

const initialState: UserState = {}
const slice = createSlice({
    name: kernelMixcUserLoginState.user,
    initialState,
    reducers: {
        setUser: (state, action: PayloadAction<User>) => {
            state.user = {value: action.payload, updatedAt: Date.now()}
        },
        clearUser: (state, action: PayloadAction) => {
            state.user = undefined
        },
        batchUpdateState: (state, action) => {
            batchUpdateState(state, action)}
    }
})

export const userActions = slice.actions

export const userConfig: ModuleSliceConfig<UserState> = {
    name: slice.name,
    reducer: slice.reducer,
    persistToStorage: true,
    syncType: SyncType.MASTER_TO_SLAVE
}