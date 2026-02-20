export enum UnitType {
    ENTITY = 'ENTITY',
    MODEL = 'MODEL',
    TERMINAL = 'TERMINAL'
}

export interface UnitData {
    id: string;
    name: string;
    path: string;
    key: string;
    value: string;
    templateId: string;
    group: string;
    unitId: string;
    unitType: UnitType;
    extra?: { [key: string]: string };
    updatedAt: number;
}

export interface UnitDataState {
    [id: string]: UnitData
}

export interface UnitDataChangedSet {
    group: string;
    updated: UnitData[];
    deleted: string[];
}