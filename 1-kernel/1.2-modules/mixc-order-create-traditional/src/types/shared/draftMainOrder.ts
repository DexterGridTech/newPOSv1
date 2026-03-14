import {MainOrderBase, ProductOrderBase} from "@impos2/kernel-mixc-order-base";

export interface DraftProductOrder extends Partial<ProductOrderBase>{
    id:string
    displayName:string
    valueStr:string
}