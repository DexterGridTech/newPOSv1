import {DeviceInfo} from "../../shared";

export interface IDeviceInfoAdapter {
    getDeviceInfo(): Promise<DeviceInfo>;
}