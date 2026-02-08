import {DeviceInfo} from "../shared/device";
import {SystemStatus} from "../core/base";

export interface DeviceStatusState {
    deviceInfo: DeviceInfo | null;
    systemStatus?: SystemStatus | null
}
