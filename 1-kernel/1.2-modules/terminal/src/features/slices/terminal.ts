import {createSlice, PayloadAction} from "@reduxjs/toolkit";
import {moduleName} from "../../moduleName";
import {TerminalState} from "../../types/state/terminalState";
import {kernelTerminalState} from "../../types/shared/moduleStateKey";
import {
    batchUpdateState,
    DeviceInfo,
    LOG_TAGS,
    logger,
    ModuleSliceConfig,
} from "@impos2/kernel-core-base";
import {SyncType} from "@impos2/kernel-core-interconnection";
import {Unit} from "../../types/shared/unit";

const initialState: TerminalState = {}
const slice = createSlice({
    name: kernelTerminalState.terminal,
    initialState,
    reducers: {
        setDeviceInfo: (state, action: PayloadAction<DeviceInfo>) => {
            logger.log([moduleName, LOG_TAGS.Reducer, "terminal"], 'setDeviceInfo', action.payload)
            state.deviceInfo = {value: action.payload, updatedAt: Date.now()}
        },
        setTerminal: (state, action: PayloadAction<{
            terminal: Unit,
            model: Unit,
            hostEntity: Unit,
            token: string
        }>) => {
            logger.log([moduleName, LOG_TAGS.Reducer, "terminal"], 'setTerminal', action.payload)
            const {terminal, model, hostEntity, token} = action.payload
            state.terminal = {value: terminal, updatedAt: Date.now()}
            state.model = {value: model, updatedAt: Date.now()}
            state.hostEntity = {value: hostEntity, updatedAt: Date.now()}
            state.token = {value: token, updatedAt: Date.now()}
        },
        setOperatingEntity: (state, action: PayloadAction<Unit>) => {
            logger.log([moduleName, LOG_TAGS.Reducer, "terminal"], 'setOperatingEntity', action.payload)
            state.operatingEntity = {value: action.payload, updatedAt: Date.now()}
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