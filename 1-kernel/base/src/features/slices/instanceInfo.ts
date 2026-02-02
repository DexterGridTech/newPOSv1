import {createSlice, PayloadAction} from "@reduxjs/toolkit";
import {DisplayMode, InstanceMode, ScreenMode, Slave, SlaveConnectionInfo, Workspace} from "../../types";
import {registerStateToPersist} from "../../core";

export interface InstanceInfo {
    instanceMode: InstanceMode
    displayMode: DisplayMode
    screenMode: ScreenMode
}

export interface InstanceInfoState {
    instance: InstanceInfo
    standAlone: boolean
    enableSlaves: boolean
    workspace: Workspace
    masterSlaves: { [name: string]: Slave }
    slaveConnectionInfo: SlaveConnectionInfo
    updatedAt?: number | null
}

const initialState: InstanceInfoState = {
    instance: {
        instanceMode: InstanceMode.MASTER,
        displayMode: DisplayMode.PRIMARY,
        screenMode: ScreenMode.DESKTOP
    },
    workspace: {
        selectedWorkspace: 'default',
        workspaces: []
    },
    standAlone: true,
    enableSlaves: false,
    masterSlaves: {},
    slaveConnectionInfo: {},
}

export const instanceInfoSlice = createSlice({
    name: 'instanceInfo',
    initialState,
    reducers: {
        setDisplayMode: (state, action: PayloadAction<DisplayMode>) => {
            state.instance.displayMode = action.payload
        },
        addSlave: (state, action: PayloadAction<{ name: string }>) => {
            const slaves = state.masterSlaves
            const existedSlave = slaves[action.payload.name]
            if (!existedSlave) {
                slaves[action.payload.name] = {
                    name: action.payload.name,
                    embedded: false,
                    addedAt: Date.now()
                }
            }
            state.masterSlaves = slaves
            state.updatedAt = Date.now()
        },
        registerSlave: (state, action: PayloadAction<{ name: string, deviceId: string }>) => {
            const slaves = state.masterSlaves
            const existedSlave = slaves[action.payload.name]
            if (existedSlave && !existedSlave.embedded) {
                existedSlave.registeredAt = Date.now()
                existedSlave.deviceId = action.payload.deviceId
            }
            state.masterSlaves = slaves
            state.updatedAt = Date.now()
        },
        unregisterSlave: (state, action: PayloadAction<{ name: string }>) => {
            const slaves = state.masterSlaves
            const existedSlave = slaves[action.payload.name]
            if (existedSlave && !existedSlave.embedded) {
                existedSlave.registeredAt = null
                existedSlave.deviceId = null
            }
            state.masterSlaves = slaves
            state.updatedAt = Date.now()
        },
        removeSlave: (state, action: PayloadAction<{ name: string }>) => {
            const slaves = state.masterSlaves
            const existedSlave = slaves[action.payload.name]
            if (existedSlave && !existedSlave.embedded) {
                delete slaves[action.payload.name]
            }
            state.masterSlaves = slaves
            state.updatedAt = Date.now()
        },
        setSlaveConnectionInfo: (state, action: PayloadAction<SlaveConnectionInfo>) => {
            state.slaveConnectionInfo = action.payload
            state.updatedAt = Date.now()
        },
    }
})

export const instanceInfoActions = instanceInfoSlice.actions

registerStateToPersist(instanceInfoSlice.name)