import {createSlice, PayloadAction} from "@reduxjs/toolkit";
import {now} from 'lodash';

import {Unit} from "../../types";
import {registerStateToPersist, registerStateToSync} from "../../core";
import {ActivateDeviceResponse} from "../../api/device";
import {updateState} from "../utils";

export interface TerminalInfoState {
    terminal?: Unit | null
    model?: Unit | null
    hostEntity?: Unit | null
    operatingEntity?: Unit | null
    token?: string | null
    updatedAt?: number | null
}

const initialState: TerminalInfoState = {}

export const terminalInfoSlice = createSlice({
    name: 'terminalInfo',
    initialState,
    reducers: {
        setTerminalInfo: (state, action: PayloadAction<ActivateDeviceResponse>) => {
            state.terminal = action.payload.terminal
            state.model = action.payload.model
            state.hostEntity = action.payload.hostEntity
            state.token = action.payload.token
            state.updatedAt = now()
        },
        setOperatingEntity: (state, action: PayloadAction<Unit>) => {
            state.operatingEntity = action.payload
            state.updatedAt = now()
        },
        updateState: updateState
    }
})

export const terminalInfoActions = terminalInfoSlice.actions

registerStateToSync(terminalInfoSlice.name)
registerStateToPersist(terminalInfoSlice.name)