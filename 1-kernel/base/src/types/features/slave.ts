import {DisplayMode, ServerAddress} from "../core";


export interface Slave {
    name:string
    addedAt:number
    embedded:boolean
    registeredAt?:number|null
    deviceId?:string|null
}
export interface SlaveInfo {
    slaveName: string|null,
    displayMode: DisplayMode
}

export interface SlaveConnectionInfo{
    slaveName?: string|null;
    masterName?: string|null;
    masterDeviceId?: string|null;
    masterServerAddress?: ServerAddress[]|null;
}
export interface RemoteCommandFromSlave {
    commandId:string;
    commandName: string;
    payload: any;
    requestId: string;
    sessionId: string;
    slaveInfo:SlaveInfo
}