import {ValueWithUpdatedAt} from "@impos2/kernel-core-base";
import {OverlayEntry} from "../foundations";

export interface OverlayRuntimeState {
    primaryOverlays: ValueWithUpdatedAt<OverlayEntry<any>[]>
    secondaryOverlays: ValueWithUpdatedAt<OverlayEntry<any>[]>
}
