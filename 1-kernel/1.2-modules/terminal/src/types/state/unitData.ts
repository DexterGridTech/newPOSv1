import {UnitData} from "../shared/unitData";

export interface UnitDataState {
    //这里用UnitData，不是UnitData的key,因为key可以重复
    [id: string]: UnitData<any>
}