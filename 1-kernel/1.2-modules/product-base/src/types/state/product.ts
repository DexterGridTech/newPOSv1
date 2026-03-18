import {ValueWithUpdatedAt} from "@impos2/kernel-core-base";
import {ProductBase} from "../shared";


export interface ProductState extends Record<string, ValueWithUpdatedAt<ProductBase>>{

}