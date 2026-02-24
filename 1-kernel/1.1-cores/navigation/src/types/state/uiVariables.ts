import {ValueWithUpdatedAt} from "@impos2/kernel-core-base";
import {ModalScreen} from "../foundations/screen";


export interface UiVariablesState extends Record<string, ValueWithUpdatedAt<any>>{
    primaryModals:ValueWithUpdatedAt<ModalScreen<any>[]>,
    secondaryModals:ValueWithUpdatedAt<ModalScreen<any>[]>
}