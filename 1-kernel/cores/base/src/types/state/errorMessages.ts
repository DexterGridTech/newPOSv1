import {ValueWithUpdateTime} from "../shared/valueWithUpdateTime";


export interface ErrorMessagesState extends Record<string, ValueWithUpdateTime<string>>{
}