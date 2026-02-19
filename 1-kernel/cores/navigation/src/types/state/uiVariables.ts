import {ValueWithUpdateAt} from "@impos2/kernel-core-base";
import {ModalScreen} from "@impos2/kernel-base";


export interface UiVariablesState extends Record<string, ValueWithUpdateAt<any>>{
    primaryModals:ValueWithUpdateAt<ModalScreen<any>[]>,
    secondaryModals:ValueWithUpdateAt<ModalScreen<any>[]>
}