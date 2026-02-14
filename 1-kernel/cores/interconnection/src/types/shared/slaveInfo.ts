export interface SlaveInfo {
    name:string
    deviceId:string
    embedded:boolean
    addedAt:number
}


export interface SlaveConnection {
    name:string
    deviceId:string
    connectedAt:number
    disconnectedAt?:number
}

export interface RemoteCommandFromSlave {
    commandId:string;
    commandName: string;
    payload: any;
    requestId: string;
    sessionId: string;
}