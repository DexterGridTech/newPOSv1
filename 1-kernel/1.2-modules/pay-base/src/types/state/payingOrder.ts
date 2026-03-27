import {ValueWithUpdatedAt} from "@impos2/kernel-core-base";
import {PayingMainOrder} from "../shared/payingMainOrder";


export interface PayingOrderState extends Record<string, ValueWithUpdatedAt<PayingMainOrder>>{

}