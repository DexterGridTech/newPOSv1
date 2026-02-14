import {DisplayMode, InstanceMode} from "../shared/instance";
import {MasterInfo} from "../shared/masterInfo";

export interface InstanceInfoState {
    instanceMode: InstanceMode
    displayMode: DisplayMode
    standalone: boolean
    enableSlave: boolean
    masterInfo?: MasterInfo | null
}