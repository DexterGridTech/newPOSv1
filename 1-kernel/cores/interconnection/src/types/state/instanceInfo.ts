import {DisplayMode, InstanceMode} from "../shared/instance";
import {Slave} from "../shared/slave";
import {Master} from "../shared/master";

export interface InstanceInfoState {
    instanceMode: InstanceMode
    displayMode: DisplayMode
    standAlone: boolean
    enableSlave: boolean
    master?:Master
    slave?: Slave
}