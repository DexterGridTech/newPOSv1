import {ServerAddress} from "../types";

export const testServerAddresses: ServerAddress[] = [
    {name: 'defaultLocal', address: 'http://localhost:8888/localServer'},
    {name: 'mockServer', address: 'http://localhost:8888/mockMasterServer'},
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