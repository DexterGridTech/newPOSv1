import {ServerAddress, ServerConnectionStatus} from "../shared/connection";
import {SlaveConnection} from "../shared/slave";

export interface MasterInterconnectionState {
    serverAddresses?:ServerAddress[]
    serverConnectionStatus?:ServerConnectionStatus
    slaveConnection?:SlaveConnection
    slaveConnectionHistory?:SlaveConnection[]
}