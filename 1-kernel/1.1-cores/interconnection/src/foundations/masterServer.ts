import {ServerAddress} from "../types";

export const testServerAddresses: ServerAddress[] = [
    {name: 'local', address: 'http://localhost:8888/masterServer'},
    {name: 'test', address: 'http://localhost:8888/mockMasterServer'},
]

export const defaultMasterInfo = {
    deviceId: 'default',
    serverAddress: testServerAddresses,
    addedAt: 0
}
export const defaultSlaveInfo = {
    deviceId: 'default',
    embedded: true,
    addedAt: 0
}