import {ValueWithUpdateAt} from "../shared/valueWithUpdateAt";


export interface ErrorMessagesState extends Record<string, ValueWithUpdateAt<string>>{
}