import {ServerAddress} from "./connection";

export interface MasterInfo {
    deviceId: string;
    serverAddress: ServerAddress[];
    addedAt: number
}
