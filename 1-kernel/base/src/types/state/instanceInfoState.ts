import {DisplayMode, InstanceMode, ScreenMode, Workspace} from "../core/base";
import {Slave, SlaveConnectionInfo} from "../features/slave";

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
