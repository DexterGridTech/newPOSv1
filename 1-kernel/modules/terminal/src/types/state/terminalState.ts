import {Unit} from "../shared/unit";
import {ValueWithUpdateAt} from "@impos2/kernel-core-base-v1";

export interface TerminalState {
    terminal?: ValueWithUpdateAt<Unit>
    model?:ValueWithUpdateAt<Unit>
    hostEntity?:ValueWithUpdateAt<Unit>
    operatingEntity?:ValueWithUpdateAt<Unit>
    token?:ValueWithUpdateAt<string>
}
