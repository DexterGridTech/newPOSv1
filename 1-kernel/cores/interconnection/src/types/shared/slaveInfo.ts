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