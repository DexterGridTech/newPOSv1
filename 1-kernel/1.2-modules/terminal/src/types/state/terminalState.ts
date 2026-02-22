import {Unit} from "../shared/unit";
import {DeviceInfo, ValueWithUpdateAt} from "@impos2/kernel-core-base";

export interface TerminalState {
    deviceInfo?:ValueWithUpdateAt<DeviceInfo>
    terminal?: ValueWithUpdateAt<Unit>
    model?:ValueWithUpdateAt<Unit>
    hostEntity?:ValueWithUpdateAt<Unit>
    operatingEntity?:ValueWithUpdateAt<Unit>
    token?:ValueWithUpdateAt<string>
}
