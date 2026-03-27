import {ProductBase} from "@impos2/kernel-product-base";


export interface Contract{
    contractCode:string
    contractName:string
    productsByContract:ProductBase[]
    validFrom:number
    validTo:number
}