import {createSlice, PayloadAction} from "@reduxjs/toolkit";
import {moduleName} from "../../moduleName";
import {TerminalState} from "../../types/state/terminalState";
import {kernelTerminalState} from "../../types/shared/moduleStateKey";
import {batchUpdateState, LOG_TAGS, logger, ModuleSliceConfig, ValueWithUpdateAt} from "@impos2/kernel-core-base-v1";
import {SyncType} from "@impos2/kernel-core-interconnection-v1";
import {Unit} from "../../types/shared/unit";

const initialState: TerminalState = {}
const slice = createSlice({
    name: kernelTerminalState.terminal,
    initialState,
    reducers: {
        setTerminal: (state, action: PayloadAction<{
            terminal: Unit,
            model: Unit,
            hostEntity: Unit,
            token: string
        }>) => {
            logger.log([moduleName, LOG_TAGS.Reducer, "terminal"], 'setTerminal', action.payload)
            const {terminal, model, hostEntity, token} = action.payload
            state.terminal = {value: terminal, updateAt: Date.now()}
            state.model = {value: model, updateAt: Date.now()}
            state.hostEntity = {value: hostEntity, updateAt: Date.now()}
            state.token = {value: token, updateAt: Date.now()}
        },
        setOperatingEntity: (state, action: PayloadAction<Unit>) => {
            logger.log([moduleName, LOG_TAGS.Reducer, "terminal"], 'setOperatingEntity', action.payload)
            state.operatingEntity = {value: action.payload, updateAt: Date.now()}
        },
        batchUpdateState: (state, action) => {
            batchUpdateState(state, action)
            logger.log([moduleName, LOG_TAGS.Reducer, "terminal"], 'batch update state', action.payload)
        }
    }
})

export const terminalActions = slice.actions

export const terminalConfig: ModuleSliceConfig<TerminalState> = {
    name: slice.name,
    reducer: slice.reducer,
    persistToStorage: true,
    syncType: SyncType.MASTER_TO_SLAVE
}