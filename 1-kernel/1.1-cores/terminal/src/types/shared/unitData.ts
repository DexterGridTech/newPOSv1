import {ValueWithUpdatedAt} from "@impos2/kernel-core-base";

export enum UnitType {
    ENTITY = 'ENTITY',
    MODEL = 'MODEL',
    TERMINAL = 'TERMINAL'
}

export interface UnitData<T> extends ValueWithUpdatedAt<T>{
    id: string;
    name: string;
    path: string;
    key: string;
    templateId: string;
    group: string;
    unitId: string;
    unitType: UnitType;
    extra?: any;
}


export interface UnitDataChangedSet {
    group: string;
    updated: UnitData<any>[];
    deleted: string[];
}