import {ValueWithUpdateAt} from "@impos2/kernel-core-base";
import {Modal} from "../foundations/screen";


export interface UiVariablesState extends Record<string, ValueWithUpdateAt<any>>{
    primaryModals:ValueWithUpdateAt<Modal<any>[]>,
    secondaryModals:ValueWithUpdateAt<Modal<any>[]>
}