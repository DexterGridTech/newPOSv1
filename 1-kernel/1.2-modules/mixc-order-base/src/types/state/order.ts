import {MainOrderBase} from "../shared";
import {ValueWithUpdatedAt} from "@impos2/kernel-core-base";


export interface OrderState extends Record<string, ValueWithUpdatedAt<MainOrderBase>> {
}