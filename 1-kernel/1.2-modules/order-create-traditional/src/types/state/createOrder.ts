import {ValueWithUpdatedAt} from "@impos2/kernel-core-base";
import {DraftProductOrder} from "../shared/draftMainOrder";


export interface CreateOrderState {
    draftProductOrders: ValueWithUpdatedAt<DraftProductOrder[]>
    selected: ValueWithUpdatedAt<string|null>
    total: ValueWithUpdatedAt<number>
    sessionId: ValueWithUpdatedAt<string>
}