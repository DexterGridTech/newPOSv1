import {OrderCreationType} from "../shared/orderCreationType";
import {ValueWithUpdatedAt} from "@impos2/kernel-core-base";
import {PayingMainOrder} from "@impos2/kernel-pay-base";

export interface OrderCreationState {
    orderCreationType:ValueWithUpdatedAt<OrderCreationType>
    selectedPayingOrder:ValueWithUpdatedAt<string|null>
}