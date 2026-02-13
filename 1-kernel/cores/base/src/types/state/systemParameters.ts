import {ValueWithUpdateTime} from "../shared/valueWithUpdateTime";

export interface SystemParametersState extends Record<string, ValueWithUpdateTime<any>>{
}