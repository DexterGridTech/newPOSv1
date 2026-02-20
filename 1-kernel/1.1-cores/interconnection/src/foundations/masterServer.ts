import {ServerAddress} from "../types";

export const defaultServerAddresses: ServerAddress[] = [
    {name: 'local', address: 'http://localhost:8888/masterServer'},
    {name: 'test', address: 'http://localhost:8888/mockMasterServer'},
]

export const defaultMasterInfo = {
    deviceId: 'default',
    serverAddress: defaultServerAddresses,
    addedAt: 0
}
export const defaultSlaveInfo = {
    deviceId: 'default',
    embedded: true,
    addedAt: 0
}
export const masterServer = {
    startServer: () => {
        return Promise.resolve(defaultServerAddresses)
    },
    stopServer: () => Promise.resolve()
}
export const registerMasterServer = (server: IMasterServer) => {
    masterServer.startServer = server.startServer
    masterServer.stopServer = server.stopServer
}

export interface IMasterServer {
    startServer: () => Promise<ServerAddress[]>
    stopServer: () => Promise<void>
}