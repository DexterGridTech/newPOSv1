import {createSlice, PayloadAction} from "@reduxjs/toolkit";
import {now} from 'lodash';

import {Unit} from "../../types";
import {registerStateToPersist, registerStateToSync} from "../../core/specialStateList";
import {ActivateDeviceResponse} from "../../api/device";
import {updateState} from "../utils";
import {KernelBaseStateNames} from "../../types/stateNames";
import {TerminalInfoState} from "../../types/state";

export type {TerminalInfoState}

const initialState: TerminalInfoState = {}

export const terminalInfoSlice = createSlice({
    name: KernelBaseStateNames.terminalInfo,
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

registerStateToSync(KernelBaseStateNames.terminalInfo)
registerStateToPersist(KernelBaseStateNames.terminalInfo)