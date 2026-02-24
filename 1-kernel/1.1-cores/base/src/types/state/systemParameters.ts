import {ValueWithUpdatedAt} from "../shared/valueWithUpdatedAt";

export interface SystemParametersState extends Record<string, ValueWithUpdatedAt<any>>{
}