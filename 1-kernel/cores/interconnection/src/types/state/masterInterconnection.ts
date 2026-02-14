import {ServerAddress, ServerConnectionStatus} from "../shared/connection";
import {SlaveConnection} from "../shared/slaveInfo";

export interface MasterInterconnectionState {
    serverAddresses?:ServerAddress[]
    serverConnectionStatus:ServerConnectionStatus
    slaveConnection?:SlaveConnection
    slaveConnectionHistory:SlaveConnection[]
}