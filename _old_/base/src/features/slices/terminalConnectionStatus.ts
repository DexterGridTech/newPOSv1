import {createSlice, PayloadAction} from "@reduxjs/toolkit";
import {ServerConnectionStatus} from "../../types";
import {registerStateToSync} from "../../core/specialStateList";
import {KernelBaseStateNames} from "../../types/stateNames";
import {TerminalConnectionStatusState} from "../../types/state";

export type {TerminalConnectionStatusState}

const initialState: TerminalConnectionStatusState = {}

export const terminalConnectionStatusSlice = createSlice({
    name: KernelBaseStateNames.terminalConnectionStatus,
    initialState,
    reducers: {
        setTerminalConnectionStatus: (state, action: PayloadAction<ServerConnectionStatus>) => {
            state.terminalConnectionStatus = action.payload
        }
    }
})

export const terminalConnectionStatusActions = terminalConnectionStatusSlice.actions

registerStateToSync(KernelBaseStateNames.terminalConnectionStatus)