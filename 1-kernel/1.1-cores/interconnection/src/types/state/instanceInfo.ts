import {DisplayMode, InstanceMode, Workspace} from "../shared/instance";
import {MasterInfo} from "../shared/masterInfo";

export interface InstanceInfoState {
    instanceMode: InstanceMode
    displayMode: DisplayMode
    workspace :Workspace
    standalone: boolean
    enableSlave: boolean
    masterInfo?: MasterInfo | null
}