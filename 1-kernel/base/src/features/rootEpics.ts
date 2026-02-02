import {instanceModeEpics} from "./epics/instanceInfo";
import {masterServerStatusEpics} from "./epics/masterServerStatus";


export const baseModuleEpics = [
    ...instanceModeEpics,
    ...masterServerStatusEpics,
];