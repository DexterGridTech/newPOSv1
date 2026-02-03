import {IStorageAdapter} from "./storage";
import {IDeviceInfoAdapter} from "./device-info";
import {IExternalCallAdapter} from "./external-call";
import {ILoggerAdapter} from "./logger";
import {ISystemStatusAdapter} from "./system-status";


export interface IPosAdapter {
    storage:IStorageAdapter
    deviceInfo:IDeviceInfoAdapter
    externalCall:IExternalCallAdapter
    logger:ILoggerAdapter
    systemStatus:ISystemStatusAdapter
}