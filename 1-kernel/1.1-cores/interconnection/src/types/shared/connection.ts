export enum ServerConnectionStatus {
    CONNECTING = 'CONNECTING',
    CONNECTED = 'CONNECTED',
    DISCONNECTED = 'DISCONNECTED'
}
export interface ServerAddress {
    name: string
    address: string
}