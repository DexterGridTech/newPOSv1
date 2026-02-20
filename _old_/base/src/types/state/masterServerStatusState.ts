import {ServerAddress, ServerConnectionStatus} from "../core/base";
import {SlaveConnection} from "../features/master";

export interface MasterServerStatusState {
    serverAddresses?:ServerAddress[]
    serverConnectionStatus?:ServerConnectionStatus
    slaveConnection?:{[name:string]:SlaveConnection}
    slaveConnectionHistory?:{[name:string]:SlaveConnection[]}
}
