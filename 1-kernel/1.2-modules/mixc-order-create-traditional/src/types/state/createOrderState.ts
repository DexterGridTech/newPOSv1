import {ValueWithUpdatedAt} from "@impos2/kernel-core-base";
import {DraftProductOrder} from "../shared/draftMainOrder";


export interface CreateOrderState {
    [id: string]: ValueWithUpdatedAt<DraftProductOrder>
}