export interface SlaveInfo {
    deviceId: string
    embedded: boolean
    addedAt: number
}


export interface SlaveConnection {
    deviceId: string
    connectedAt: number
    disconnectedAt?: number
}