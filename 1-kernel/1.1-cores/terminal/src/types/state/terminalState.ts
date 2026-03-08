import {Unit} from "../shared/unit";
import {DeviceInfo, ValueWithUpdatedAt} from "@impos2/kernel-core-base";

export interface TerminalState {
    deviceInfo?:ValueWithUpdatedAt<DeviceInfo>
    terminal?: ValueWithUpdatedAt<Unit>
    model?:ValueWithUpdatedAt<Unit>
    hostEntity?:ValueWithUpdatedAt<Unit>
    operatingEntity?:ValueWithUpdatedAt<Unit>
    token?:ValueWithUpdatedAt<string>
}
