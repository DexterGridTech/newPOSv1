import {UnitType} from "./unitData";

export interface Unit {
    id: string;
    type: UnitType;
    rootPath: string[]
}
