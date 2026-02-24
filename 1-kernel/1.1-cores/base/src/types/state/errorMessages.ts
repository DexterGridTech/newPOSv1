import {ValueWithUpdatedAt} from "../shared/valueWithUpdatedAt";


export interface ErrorMessagesState extends Record<string, ValueWithUpdatedAt<string>>{
}