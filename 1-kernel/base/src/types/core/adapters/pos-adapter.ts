import {IStorageAdapter} from "./storage";
import {IDeviceInfoAdapter} from "./device-info";


export interface IPosAdapter {
    storage:IStorageAdapter
    deviceInfo:IDeviceInfoAdapter
}