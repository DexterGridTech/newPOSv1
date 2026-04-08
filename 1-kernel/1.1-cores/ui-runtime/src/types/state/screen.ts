import {ValueWithUpdatedAt} from "@impos2/kernel-core-base";
import {ScreenEntry} from "../foundations";

export interface ScreenRuntimeState extends Record<string, ValueWithUpdatedAt<ScreenEntry<any> | null>> {
}
