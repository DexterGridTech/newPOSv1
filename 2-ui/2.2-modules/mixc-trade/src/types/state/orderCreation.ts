import {OrderCreationType} from "../shared/orderCreationType";
import {ValueWithUpdatedAt} from "@impos2/kernel-core-base";
import {PayingMainOrder} from "@impos2/kernel-mixc-order-pay";

export interface OrderCreationState {
    orderCreationType:ValueWithUpdatedAt<OrderCreationType>
    selectedPayingOrder:ValueWithUpdatedAt<string|null>
}