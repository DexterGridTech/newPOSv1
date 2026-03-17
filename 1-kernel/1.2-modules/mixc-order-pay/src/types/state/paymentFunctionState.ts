import {ValueWithUpdatedAt} from "@impos2/kernel-core-base";
import {PaymentFunction} from "../shared/paymentFunction";


export interface PaymentFunctionState extends Record<string, ValueWithUpdatedAt<PaymentFunction>>{}