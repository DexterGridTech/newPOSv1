import {OrderCreationType} from "../shared/orderCreationType";
import {ValueWithUpdatedAt} from "@impos2/kernel-core-base";

export interface OrderCreationState {
    orderCreationType:ValueWithUpdatedAt<OrderCreationType>
}