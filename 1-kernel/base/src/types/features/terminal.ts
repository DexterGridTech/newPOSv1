import {SlaveInfo} from "./slave";

export interface RemoteCommandFromKernel {
    commandId:string;
    type: string;
    payload: any;
    requestId: string;
    sessionId: string;
}