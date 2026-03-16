import {MainOrderBase, ProductOrderBase} from "@impos2/kernel-mixc-order-base";

export interface DraftProductOrder extends ProductOrderBase{
    id:string
    displayName:string
    valueStr:string
}