import {ServerAddress} from "../types";

export const defaultServerAddresses: ServerAddress[] = [
    {name: 'local', address: 'http://localhost:9999/masterServer'},
    {name: 'test', address: 'http://localhost:9999/mockMasterServer'},
]

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