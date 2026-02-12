import {ValueWithUpdate} from "../shared/valueWithUpdate";

export interface SystemParametersState {
    [key: string]: ValueWithUpdate<any>
}