import {shortId} from "@impos2/kernel-core-base";


export const generateMainOrderCode =
    () => shortId()
export const generateSubOrderCode =
    (mainOrderCode:string) => shortId()

export const generateProductOrderCode =
    (subOrderCode:string,productCount:number,index:number) => shortId()

export const generatePaymentRequestCode =
    (mainOrderCode:string) => shortId()

export const generatePaymentCode =
    (mainOrderCode:string,paymentRequestCode:string) => shortId()

export const generatePaymentWithdrawCode =
    (paymentCode:string) => shortId()
