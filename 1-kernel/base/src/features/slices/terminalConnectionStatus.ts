import {createSlice, PayloadAction} from "@reduxjs/toolkit";
import {ServerConnectionStatus} from "../../types";
import {registerStateToSync} from "../../core/specialStateList";

export interface TerminalConnectionStatusState {
    terminalConnectionStatus?: ServerConnectionStatus
}

const initialState: TerminalConnectionStatusState = {}

export const terminalConnectionStatusSlice = createSlice({
    name: 'terminalConnectionStatus',
    initialState,
    reducers: {
        setTerminalConnectionStatus: (state, action: PayloadAction<ServerConnectionStatus>) => {
            state.terminalConnectionStatus = action.payload
        }
    }
})

export const terminalConnectionStatusActions = terminalConnectionStatusSlice.actions

registerStateToSync(terminalConnectionStatusSlice.name)