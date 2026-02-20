import {ValueWithUpdateAt} from "@impos2/kernel-core-base";

export enum UnitType {
    ENTITY = 'ENTITY',
    MODEL = 'MODEL',
    TERMINAL = 'TERMINAL'
}

export interface UnitData extends ValueWithUpdateAt<any>{
    id: string;
    name: string;
    path: string;
    key: string;
    templateId: string;
    group: string;
    unitId: string;
    unitType: UnitType;
    extra?: { [key: string]: string };
}


export interface UnitDataChangedSet {
    group: string;
    updated: UnitData[];
    deleted: string[];
}