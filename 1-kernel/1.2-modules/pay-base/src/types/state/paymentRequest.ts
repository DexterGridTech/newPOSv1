import {ValueWithUpdatedAt} from "@impos2/kernel-core-base";
import {PaymentRequest} from "../../types";


export interface PaymentRequestState extends Record<string, ValueWithUpdatedAt<PaymentRequest>> {
}