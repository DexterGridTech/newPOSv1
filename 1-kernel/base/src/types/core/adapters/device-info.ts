import {DeviceInfo} from "../../features";

export interface IDeviceInfoAdapter {
    getDeviceInfo(): Promise<DeviceInfo>;
}