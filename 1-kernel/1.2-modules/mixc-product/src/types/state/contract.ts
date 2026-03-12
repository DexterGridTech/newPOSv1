import {Contract} from "../shared";
import {ValueWithUpdatedAt} from "@impos2/kernel-core-base";


export interface ContractState extends Record<string, ValueWithUpdatedAt<Contract>>{

}