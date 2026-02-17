import {DisplayMode, InstanceMode, WorkSpace} from "../shared/instance";
import {MasterInfo} from "../shared/masterInfo";

export interface InstanceInfoState {
    instanceMode: InstanceMode
    displayMode: DisplayMode
    workspace :WorkSpace
    standalone: boolean
    enableSlave: boolean
    masterInfo?: MasterInfo | null
}